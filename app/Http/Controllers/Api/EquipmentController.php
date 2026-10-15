<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Equipment;
use Illuminate\Http\Request;

class EquipmentController extends Controller
{
    public function index()
    {
        return response()->json(
            Equipment::query()->latest()->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:255'],
            'quantity' => ['required', 'integer', 'min:0'],
            'description' => ['nullable', 'string'],
        ]);

        $validated['available_quantity'] = $validated['quantity'];

        $equipment = Equipment::create($validated);

        return response()->json([
            'message' => 'Equipment added successfully.',
            'equipment' => $equipment,
        ], 201);
    }

    public function show(string $id)
    {
        return response()->json(Equipment::findOrFail($id));
    }

    public function update(Request $request, string $id)
    {
        $equipment = Equipment::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['sometimes', 'required', 'string', 'max:255'],
            'quantity' => ['sometimes', 'required', 'integer', 'min:0'],
            'description' => ['sometimes', 'nullable', 'string'],
        ]);

        if (isset($validated['quantity'])) {
            $borrowed = $equipment->quantity - $equipment->available_quantity;

            if ($validated['quantity'] < $borrowed) {
                return response()->json([
                    'message' => 'Quantity cannot be lower than the number of items currently borrowed.',
                ], 422);
            }

            $validated['available_quantity'] =
                $validated['quantity'] - $borrowed;
        }

        $equipment->update($validated);

        return response()->json([
            'message' => 'Equipment updated successfully.',
            'equipment' => $equipment->fresh(),
        ]);
    }

    public function destroy(string $id)
    {
        $equipment = Equipment::findOrFail($id);

        if ($equipment->available_quantity < $equipment->quantity) {
            return response()->json([
                'message' => 'This equipment cannot be deleted while items are borrowed.',
            ], 422);
        }

        $equipment->delete();

        return response()->json([
            'message' => 'Equipment deleted successfully.',
        ]);
    }
}