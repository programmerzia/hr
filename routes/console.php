<?php

use App\Domain\Attendance\Actions\CloseDay;
use App\Domain\Attendance\Actions\SweepIdle;
use App\Domain\Leave\Actions\RolloverYear;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('attendance:sweep', function (SweepIdle $sweep) {
    $n = $sweep();
    $this->info("Idle breaks opened: {$n}");
})->purpose('Open idle breaks for working days without a recent heartbeat');

Schedule::command('attendance:sweep')->everyMinute()->withoutOverlapping();

Schedule::command('billing:sweep-overdue')->daily();

Artisan::command('attendance:close-day {date?}', function (CloseDay $close) {
    $n = $close($this->argument('date'));
    $this->info("Days closed: {$n}");
})->purpose('Close and grade attendance days for a date (default yesterday)');

Schedule::command('attendance:close-day')->dailyAt('00:10')->withoutOverlapping();

Artisan::command('leave:rollover {year?}', function (RolloverYear $rollover) {
    $from = (int) ($this->argument('year') ?? now()->year - 1);
    $r = $rollover($from);
    $this->info("Rolled {$from} into ".($from + 1).": {$r['created']} created, {$r['skipped']} skipped");
})->purpose('Open next year leave balances with carry-forward (argument: the year being closed)');

Schedule::command('leave:rollover')->yearlyOn(1, 1, '00:30')->withoutOverlapping();
