<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Borrowing extends Model
{
    protected $fillable = [
        'borrower_type',
        'borrower_name',
        'borrower_id',
        'equipment_id',
        'quantity',
        'borrowed_at',
        'expected_return_at',
        'returned_at',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'borrowed_at' => 'date',
            'expected_return_at' => 'date',
            'returned_at' => 'date',
        ];
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }
}
