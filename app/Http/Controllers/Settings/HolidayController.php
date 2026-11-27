<?php

namespace App\Http\Controllers\Settings;

use App\Domain\Attendance\Actions\RegradeDays;
use App\Domain\Attendance\Services\PayrollLock;
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
        if ($msg = PayrollLock::message((string) $request->validated('date'))) {
            return back()->with('error', $msg);
        }
        $h = Holiday::create($request->validated());
        app(RegradeDays::class)->forDate($h->date->toDateString());
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
            if (PayrollLock::locked($m[1])) {
                $skipped[] = $m[1].' (payroll approved)';

                continue;
            }
            Holiday::create(['date' => $m[1], 'name' => mb_substr(trim($m[2]), 0, 80)]);
            app(RegradeDays::class)->forDate($m[1]);
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
        if ($msg = PayrollLock::message($holiday->date->toDateString())) {
            return back()->with('error', $msg);
        }
        $holiday->delete();
        app(RegradeDays::class)->forDate($holiday->date->toDateString());
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
