<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskLabel extends Model
{
    use HasFactory;

    protected $guarded = [];

    public $incrementing = false;

    protected $primaryKey = null;

    public $timestamps = false;

    protected function casts(): array
    {
        return [

        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'task_id');
    }

    public function label(): BelongsTo
    {
        return $this->belongsTo(Label::class, 'label_id');
    }
}
