
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('borrowings', function (Blueprint $table) {
            $table->id();

            // Borrower information
            $table->enum('borrower_type', ['student', 'staff']);
            $table->string('borrower_name');
            $table->string('borrower_id');

            // Equipment information
            $table->foreignId('equipment_id')
                ->constrained('equipment')
                ->restrictOnDelete();

            $table->unsignedInteger('quantity');

            // Borrowing and return dates
            $table->date('borrowed_at');
            $table->date('expected_return_at');
            $table->date('returned_at')->nullable();

            // Current borrowing status
            $table->enum('status', ['borrowed', 'returned'])
                ->default('borrowed');

            $table->text('notes')->nullable();

            $table->timestamps();

            $table->index(['status', 'expected_return_at']);
            $table->index(['borrower_type', 'borrower_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('borrowings');
    }
};
