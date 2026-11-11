<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TimeSegment extends Model
{
    use HasFactory, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'ended_at' => 'datetime'];
    }

    public function day()
    {
        return $this->belongsTo(AttendanceDay::class, 'attendance_day_id');
    }

    public function seconds(CarbonInterface $now): int
    {
        return max(0, (int) round(($this->ended_at ?? $now)->getTimestamp() - $this->started_at->getTimestamp()));
    }
}
