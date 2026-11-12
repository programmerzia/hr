<?php

namespace App\Http\Controllers\Settings;

use App\Domain\Settings\SettingsLog;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\BulkHolidaysRequest;
use App\Http\Requests\Settings\HolidayRequest;
use App\Models\Holiday;
use App\Models\PayrollRun;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class HolidayController extends Controller
{
    public function index(Request $request): Response
    {
        $year = max(2000, min(2100, (int) $request->query('year', now()->year)));
        $paid = PayrollRun::where('status', 'paid')->where('year', $year)->pluck('month')->all();

        return Inertia::render('Settings/HolidaysPage', [
            'year' => $year,
            'holidays' => Holiday::whereYear('date', $year)->orderBy('date')->get()->map(fn (Holiday $h) => [
                'id' => $h->id, 'date' => $h->date->toDateString(), 'name' => $h->name,
                'locked' => in_array($h->date->month, $paid, true),
            ])->all(),
            'history' => SettingsLog::recent('holidays'),
        ]);
    }

    public function store(HolidayRequest $request): RedirectResponse
    {
        $h = Holiday::create($request->validated());
        SettingsLog::record($request->user(), 'holidays', "added holiday {$h->name} on ".$h->date->format('j M Y'), subjectId: $h->id);

        return back()->with('success', 'Holiday added');
    }

    public function bulk(BulkHolidaysRequest $request): RedirectResponse
    {
        $added = 0;
        $skipped = [];
        foreach (preg_split('/\R/', $request->validated('lines')) as $i => $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            if (! preg_match('/^(\d{4}-\d{2}-\d{2})\s+(.+)$/u', $line, $m) || ! $this->validDate($m[1])) {
                $skipped[] = 'line '.($i + 1).' (format)';

                continue;
            }
            if (Holiday::whereDate('date', $m[1])->exists()) {
                $skipped[] = $m[1].' (already a holiday)';

                continue;
            }
            Holiday::create(['date' => $m[1], 'name' => mb_substr(trim($m[2]), 0, 80)]);
            $added++;
        }
        if ($added > 0) {
            SettingsLog::record($request->user(), 'holidays', "bulk-added {$added} holiday".($added === 1 ? '' : 's'));
        }
        if ($added === 0 && $skipped) {
            return back()->with('error', 'Nothing added. Skipped: '.implode(', ', $skipped));
        }

        return back()->with('success', "Added {$added}".($skipped ? '. Skipped: '.implode(', ', $skipped) : ''));
    }

    public function destroy(Request $request, Holiday $holiday): RedirectResponse
    {
        $paid = PayrollRun::where('status', 'paid')->where('year', $holiday->date->year)->where('month', $holiday->date->month)->exists();
        if ($paid) {
            return back()->with('error', 'Payroll for '.$holiday->date->format('F Y').' is already paid, so this holiday cannot be removed.');
        }
        $holiday->delete();
        SettingsLog::record($request->user(), 'holidays', "removed holiday {$holiday->name} on ".$holiday->date->format('j M Y'), subjectId: $holiday->id);

        return back()->with('success', 'Holiday removed');
    }

    private function validDate(string $d): bool
    {
        try {
            return CarbonImmutable::createFromFormat('!Y-m-d', $d)->toDateString() === $d;
        } catch (\Throwable) {
            return false;
        }
    }
}
