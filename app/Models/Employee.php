<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Employee extends Model
{
    use HasFactory, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'joined_on' => 'date',
            'probation_until' => 'date',
            'exited_on' => 'date',
        ];
    }

    public function user(): HasOne
    {
        return $this->hasOne(User::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function ledTeams(): HasMany
    {
        return $this->hasMany(Team::class, 'lead_employee_id');
    }

    public function salaryStructures(): HasMany
    {
        return $this->hasMany(SalaryStructure::class)->orderBy('effective_from');
    }

    public function bankAccounts(): HasMany
    {
        return $this->hasMany(BankAccount::class);
    }

    public function attendanceDays(): HasMany
    {
        return $this->hasMany(AttendanceDay::class);
    }

    /** Ids of employees in teams this employee leads (team-lead scope). */
    public function ledEmployeeIds(): array
    {
        $teamIds = Team::where('lead_employee_id', $this->id)->pluck('id');
        if ($teamIds->isEmpty()) {
            return [];
        }

        return Employee::whereIn('team_id', $teamIds)
            ->pluck('id')
            ->merge(TeamMember::whereIn('team_id', $teamIds)->pluck('employee_id'))
            ->unique()->values()->all();
    }

    public function leads(Employee $other): bool
    {
        return in_array($other->id, $this->ledEmployeeIds(), true);
    }
}
