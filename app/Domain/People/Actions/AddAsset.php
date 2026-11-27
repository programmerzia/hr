<?php

namespace App\Domain\People\Actions;

use App\Models\Employee;
use App\Models\EmployeeAsset;

class AddAsset
{
    public function __invoke(Employee $employee, array $asset): EmployeeAsset
    {
        $created = EmployeeAsset::create([
            'employee_id' => $employee->id,
            'name' => trim($asset['name']),
            'tag' => trim($asset['tag']),
            'assigned_on' => $asset['assigned_on'],
            'returned_on' => null,
            'status' => 'assigned',
        ]);
        Concerns::audit($employee, "Assigned asset {$created->name} ({$created->tag})", ['asset_id' => $created->id]);

        return $created;
    }
}
