<?php
declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class SchemaTest extends TestCase
{
    public function testMigrationCreatesEveryTable(): void
    {
        $schema = TestDatabase::create()->getSchemaBuilder();

        foreach (['ingredients', 'tags', 'recipes', 'recipe_tags', 'recipe_ingredients', 'pantry_items', 'meal_plan_entries'] as $table) {
            $this->assertTrue($schema->hasTable($table), "missing table $table");
        }
    }

    public function testRecipeIngredientsHasNoUnitColumn(): void
    {
        $schema = TestDatabase::create()->getSchemaBuilder();

        $this->assertTrue($schema->hasColumn('recipe_ingredients', 'quantity'));
        $this->assertFalse($schema->hasColumn('recipe_ingredients', 'unit'));
    }

    public function testForeignKeysAreEnforced(): void
    {
        $db = TestDatabase::create();

        $this->expectException(\Illuminate\Database\QueryException::class);
        $db->table('pantry_items')->insert([
            'id' => 'p1', 'user_id' => 1, 'ingredient_id' => 'missing', 'quantity' => 1, 'max_stock' => 3,
        ]);
    }

    public function testUniqueNamePerUser(): void
    {
        $db = TestDatabase::create();
        $row = ['id' => 'a', 'user_id' => 1, 'name' => 'soľ', 'default_unit' => 'g', 'category' => 'Other'];
        $db->table('ingredients')->insert($row);

        $this->expectException(\Illuminate\Database\QueryException::class);
        $db->table('ingredients')->insert(['id' => 'b'] + $row);
    }
}
