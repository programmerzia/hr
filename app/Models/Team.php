<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Team extends Model
{
    use HasFactory, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [];
    }

    public function lead()
    {
        return $this->belongsTo(Employee::class, 'lead_employee_id');
    }

    public function members()
    {
        return $this->belongsToMany(Employee::class, 'team_members');
    }
}
