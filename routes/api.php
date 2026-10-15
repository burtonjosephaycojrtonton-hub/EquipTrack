
<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BorrowingController;
use App\Http\Controllers\Api\EquipmentController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Authentication routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Protected routes: authenticated users only
Route::middleware('auth:sanctum')->group(function () {

    // Current user and logout
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::post('/logout', [AuthController::class, 'logout']);

    // Equipment inventory CRUD
    Route::apiResource('equipment', EquipmentController::class);

    // Borrowing records CRUD
    Route::apiResource('borrowings', BorrowingController::class);

    // Return borrowed equipment and restore available stock
    Route::post(
        '/borrowings/{id}/return',
        [BorrowingController::class, 'returnEquipment']
    );
});
