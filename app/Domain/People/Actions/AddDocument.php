<?php

namespace App\Domain\People\Actions;

use App\Models\Employee;
use App\Models\EmployeeDocument;
use Illuminate\Http\UploadedFile;

class AddDocument
{
    public function __invoke(Employee $employee, string $kind, UploadedFile $file): EmployeeDocument
    {
        $path = $file->store("documents/{$employee->id}", 'local');

        $doc = EmployeeDocument::create([
            'employee_id' => $employee->id,
            'kind' => $kind,
            'name' => $file->getClientOriginalName(),
            'path' => $path,
            'uploaded_at' => now(),
        ]);
        Concerns::audit($employee, "Added document {$doc->name} ({$kind})", ['document_id' => $doc->id]);

        return $doc;
    }
}
