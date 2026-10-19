<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateTables extends AbstractMigration
{
    private const TABLE = ['encoding' => 'utf8mb4', 'collation' => 'utf8mb4_bin', 'engine' => 'InnoDB'];

    public function change(): void
    {
        $this->table('ingredients', ['id' => false, 'primary_key' => 'id'] + self::TABLE)
            ->addColumn('id', 'char', ['limit' => 36])
            ->addColumn('user_id', 'integer', ['signed' => false, 'default' => 1])
            ->addColumn('name', 'string', ['limit' => 120])
            ->addColumn('default_unit', 'string', ['limit' => 16])
            ->addColumn('category', 'string', ['limit' => 60])
            ->addIndex(['user_id', 'name'], ['unique' => true])
            ->create();

        $this->table('tags', ['id' => false, 'primary_key' => 'id'] + self::TABLE)
            ->addColumn('id', 'char', ['limit' => 36])
            ->addColumn('user_id', 'integer', ['signed' => false, 'default' => 1])
            ->addColumn('name', 'string', ['limit' => 60])
            ->addColumn('color', 'string', ['limit' => 16])
            ->addIndex(['user_id', 'name'], ['unique' => true])
            ->create();

        $this->table('recipes', ['id' => false, 'primary_key' => 'id'] + self::TABLE)
            ->addColumn('id', 'char', ['limit' => 36])
            ->addColumn('user_id', 'integer', ['signed' => false, 'default' => 1])
            ->addColumn('emoji', 'string', ['limit' => 16])
            ->addColumn('name', 'string', ['limit' => 200])
            ->addColumn('servings', 'integer', ['signed' => false])
            ->addColumn('notes', 'text')
            ->addColumn('created_at', 'biginteger') // epoch milliseconds, like Recipe.createdAt
            ->create();

        $this->table('recipe_tags', ['id' => false, 'primary_key' => ['recipe_id', 'tag_id']] + self::TABLE)
            ->addColumn('recipe_id', 'char', ['limit' => 36])
            ->addColumn('tag_id', 'char', ['limit' => 36])
            ->addColumn('position', 'integer', ['signed' => false])
            ->addForeignKey('recipe_id', 'recipes', 'id', ['delete' => 'CASCADE'])
            ->addForeignKey('tag_id', 'tags', 'id', ['delete' => 'RESTRICT'])
            ->create();

        $this->table('recipe_ingredients', ['id' => false, 'primary_key' => ['recipe_id', 'position']] + self::TABLE)
            ->addColumn('recipe_id', 'char', ['limit' => 36])
            ->addColumn('position', 'integer', ['signed' => false])
            ->addColumn('ingredient_id', 'char', ['limit' => 36])
            ->addColumn('quantity', 'double')
            ->addForeignKey('recipe_id', 'recipes', 'id', ['delete' => 'CASCADE'])
            ->addForeignKey('ingredient_id', 'ingredients', 'id', ['delete' => 'RESTRICT'])
            ->create();

        $this->table('pantry_items', ['id' => false, 'primary_key' => 'id'] + self::TABLE)
            ->addColumn('id', 'char', ['limit' => 36])
            ->addColumn('user_id', 'integer', ['signed' => false, 'default' => 1])
            ->addColumn('ingredient_id', 'char', ['limit' => 36])
            ->addColumn('quantity', 'double')
            ->addColumn('max_stock', 'double')
            ->addForeignKey('ingredient_id', 'ingredients', 'id', ['delete' => 'RESTRICT'])
            ->addIndex(['user_id', 'ingredient_id'], ['unique' => true])
            ->create();

        $this->table('meal_plan_entries', ['id' => false, 'primary_key' => 'id'] + self::TABLE)
            ->addColumn('id', 'char', ['limit' => 36])
            ->addColumn('user_id', 'integer', ['signed' => false, 'default' => 1])
            ->addColumn('date', 'string', ['limit' => 10]) // YYYY-MM-DD
            ->addColumn('slot', 'string', ['limit' => 16])
            ->addColumn('recipe_id', 'char', ['limit' => 36])
            ->addColumn('servings', 'integer', ['signed' => false])
            ->addColumn('cooked', 'boolean', ['default' => false])
            ->addForeignKey('recipe_id', 'recipes', 'id', ['delete' => 'CASCADE'])
            ->create();
    }
}
