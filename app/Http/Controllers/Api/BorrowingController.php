<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Borrowing;
use App\Models\Equipment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BorrowingController extends Controller
{
    public function index()
    {
        return response()->json(
            Borrowing::with('equipment')->latest()->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'borrower_type' => ['required', Rule::in(['student', 'staff'])],
            'borrower_name' => ['required', 'string', 'max:255'],
            'borrower_id' => ['required', 'string', 'max:100'],
            'equipment_id' => ['required', 'integer', 'exists:equipment,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'borrowed_at' => ['required', 'date'],
            'expected_return_at' => [
                'required', 'date', 'after_or_equal:borrowed_at',
            ],
            'notes' => ['nullable', 'string'],
        ]);

        $borrowing = DB::transaction(function () use ($validated) {
            $equipment = Equipment::whereKey($validated['equipment_id'])
                ->lockForUpdate()
                ->firstOrFail();

            if ($equipment->available_quantity < $validated['quantity']) {
                throw ValidationException::withMessages([
                    'quantity' => [
                        'Not enough equipment is available to borrow.',
                    ],
                ]);
            }

            $equipment->decrement(
                'available_quantity',
                $validated['quantity']
            );

            return Borrowing::create([
                ...$validated,
                'status' => 'borrowed',
            ]);
        });

        return response()->json([
            'message' => 'Equipment borrowed successfully.',
            'borrowing' => $borrowing->load('equipment'),
        ], 201);
    }

    public function show(string $id)
    {
        return response()->json(
            Borrowing::with('equipment')->findOrFail($id)
        );
    }

    public function update(Request $request, string $id)
    {
        $validated = $request->validate([
            'borrower_type' => ['sometimes', Rule::in(['student', 'staff'])],
            'borrower_name' => ['sometimes', 'required', 'string', 'max:255'],
            'borrower_id' => ['sometimes', 'required', 'string', 'max:100'],
            'borrowed_at' => ['sometimes', 'required', 'date'],
            'expected_return_at' => ['sometimes', 'required', 'date'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ]);

        $borrowing = Borrowing::findOrFail($id);

        if ($borrowing->status === 'returned') {
            return response()->json([
                'message' => 'Returned borrowing records cannot be edited.',
            ], 422);
        }

        $borrowedAt = $validated['borrowed_at'] ?? $borrowing->borrowed_at->format('Y-m-d');
        $expectedAt = $validated['expected_return_at'] ?? $borrowing->expected_return_at->format('Y-m-d');

        if ($expectedAt < $borrowedAt) {
            throw ValidationException::withMessages([
                'expected_return_at' => [
                    'The expected return date must be on or after the borrowing date.',
                ],
            ]);
        }

        $borrowing->update($validated);

        return response()->json([
            'message' => 'Borrowing record updated successfully.',
            'borrowing' => $borrowing->fresh()->load('equipment'),
        ]);
    }

    public function returnEquipment(string $id)
    {
        $borrowing = DB::transaction(function () use ($id) {
            $record = Borrowing::whereKey($id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($record->status === 'returned') {
                throw ValidationException::withMessages([
                    'status' => ['This equipment has already been returned.'],
                ]);
            }

            $equipment = Equipment::whereKey($record->equipment_id)
                ->lockForUpdate()
                ->firstOrFail();

            if (
                $equipment->available_quantity + $record->quantity
                > $equipment->quantity
            ) {
                throw ValidationException::withMessages([
                    'quantity' => [
                        'Returning these items would exceed the equipment stock total.',
                    ],
                ]);
            }

            $equipment->increment('available_quantity', $record->quantity);

            $record->update([
                'status' => 'returned',
                'returned_at' => now()->toDateString(),
            ]);

            return $record;
        });

        return response()->json([
            'message' => 'Equipment returned successfully.',
            'borrowing' => $borrowing->load('equipment'),
        ]);
    }

    public function destroy(string $id)
    {
        $borrowing = Borrowing::findOrFail($id);

        if ($borrowing->status === 'borrowed') {
            return response()->json([
                'message' => 'Active borrowing records cannot be deleted. Return the equipment first.',
            ], 422);
        }

        $borrowing->delete();

        return response()->json([
            'message' => 'Borrowing record deleted successfully.',
        ]);
    }
}
