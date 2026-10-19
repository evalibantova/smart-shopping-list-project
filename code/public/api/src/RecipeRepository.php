<?php
declare(strict_types=1);

namespace MealPlanner\Api;

final class RecipeRepository extends Repository
{
    /** @return list<array<string, mixed>> */
    public function all(): array
    {
        return $this->hydrate($this->owned('recipes')->orderBy('created_at')->orderBy('id')->get()->all());
    }

    /** @return array<string, mixed> */
    public function find(string $id): array
    {
        $row = $this->owned('recipes')->where('id', $id)->first();
        if ($row === null) {
            throw ApiError::notFound();
        }

        return $this->hydrate([$row])[0];
    }

    /** @param array<string, mixed> $body */
    public function create(array $body): array
    {
        $id = Input::newId($body);
        $fields = $this->parse($body, partial: false);

        $this->db->transaction(function () use ($id, $fields) {
            $this->db->table('recipes')->insert([
                'id' => $id,
                'user_id' => Database::USER_ID,
                'emoji' => $fields['emoji'],
                'name' => $fields['name'],
                'servings' => $fields['servings'],
                'notes' => $fields['notes'],
                'created_at' => (int) round(microtime(true) * 1000),
            ]);
            $this->replaceLinks($id, $fields['tagIds'], $fields['ingredients']);
        });

        return $this->find($id);
    }

    /** @param array<string, mixed> $body */
    public function update(string $id, array $body): array
    {
        $this->find($id); // 404 when missing
        $fields = $this->parse($body, partial: true);

        $this->db->transaction(function () use ($id, $fields) {
            $columns = array_intersect_key($fields, array_flip(['emoji', 'name', 'servings', 'notes']));
            if ($columns !== []) {
                $this->owned('recipes')->where('id', $id)->update($columns);
            }
            if (array_key_exists('tagIds', $fields)) {
                $this->db->table('recipe_tags')->where('recipe_id', $id)->delete();
                $this->insertTags($id, $fields['tagIds']);
            }
            if (array_key_exists('ingredients', $fields)) {
                $this->db->table('recipe_ingredients')->where('recipe_id', $id)->delete();
                $this->insertIngredients($id, $fields['ingredients']);
            }
        });

        return $this->find($id);
    }

    public function delete(string $id): void
    {
        $this->find($id); // 404 when missing
        $this->owned('recipes')->where('id', $id)->delete(); // join rows go via ON DELETE CASCADE
    }

    /**
     * Validates the body. Full mode requires emoji, name and servings and defaults the rest;
     * partial mode validates only the keys present.
     *
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    private function parse(array $body, bool $partial): array
    {
        $rules = [
            'emoji' => fn () => Input::str($body, 'emoji', 16),
            'name' => fn () => Input::str($body, 'name', 200),
            'servings' => fn () => Input::integer($body, 'servings', 1),
            'notes' => fn () => Input::text($body, 'notes'),
            'tagIds' => fn () => self::tagIds($body['tagIds'] ?? null),
            'ingredients' => fn () => self::ingredientLines($body['ingredients'] ?? null),
        ];
        $defaults = ['notes' => '', 'tagIds' => [], 'ingredients' => []];

        $out = [];
        foreach ($rules as $key => $rule) {
            if (array_key_exists($key, $body)) {
                $out[$key] = $rule();
            } elseif (!$partial) {
                if (!array_key_exists($key, $defaults)) {
                    throw ApiError::invalid();
                }
                $out[$key] = $defaults[$key];
            }
        }

        return $out;
    }

    /** @return list<string> */
    private static function tagIds(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value)) {
            throw ApiError::invalid();
        }

        return array_map(fn ($id) => Input::id(['id' => $id], 'id'), $value);
    }

    /** @return list<array{ingredientId:string,quantity:float}> */
    private static function ingredientLines(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value)) {
            throw ApiError::invalid();
        }

        return array_map(function ($line) {
            if (!is_array($line)) {
                throw ApiError::invalid();
            }

            return ['ingredientId' => Input::id($line, 'ingredientId'), 'quantity' => Input::number($line, 'quantity')];
        }, $value);
    }

    private function replaceLinks(string $id, array $tagIds, array $ingredients): void
    {
        $this->insertTags($id, $tagIds);
        $this->insertIngredients($id, $ingredients);
    }

    private function insertTags(string $id, array $tagIds): void
    {
        foreach (array_values($tagIds) as $position => $tagId) {
            $this->db->table('recipe_tags')->insert(['recipe_id' => $id, 'tag_id' => $tagId, 'position' => $position]);
        }
    }

    private function insertIngredients(string $id, array $ingredients): void
    {
        foreach (array_values($ingredients) as $position => $line) {
            $this->db->table('recipe_ingredients')->insert([
                'recipe_id' => $id,
                'position' => $position,
                'ingredient_id' => $line['ingredientId'],
                'quantity' => $line['quantity'],
            ]);
        }
    }

    /**
     * @param list<object> $rows
     * @return list<array<string, mixed>>
     */
    private function hydrate(array $rows): array
    {
        $ids = array_map(fn ($r) => $r->id, $rows);

        $tags = [];
        foreach ($this->db->table('recipe_tags')->whereIn('recipe_id', $ids)->orderBy('position')->get() as $row) {
            $tags[$row->recipe_id][] = $row->tag_id;
        }
        $lines = [];
        foreach ($this->db->table('recipe_ingredients')->whereIn('recipe_id', $ids)->orderBy('position')->get() as $row) {
            $lines[$row->recipe_id][] = ['ingredientId' => $row->ingredient_id, 'quantity' => (float) $row->quantity];
        }

        return array_map(fn ($r) => [
            'id' => $r->id,
            'emoji' => $r->emoji,
            'name' => $r->name,
            'servings' => (int) $r->servings,
            'tagIds' => $tags[$r->id] ?? [],
            'ingredients' => $lines[$r->id] ?? [],
            'notes' => $r->notes,
            'createdAt' => (int) $r->created_at,
        ], $rows);
    }
}
