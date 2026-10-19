<?php
declare(strict_types=1);

namespace MealPlanner\Api;

final class IngredientRepository extends Repository
{
    public const UNITS = ['g', 'ml', 'kg', 'l', 'pcs', 'cloves', 'tbsp', 'tsp'];

    /** @return list<array{id:string,name:string,default_unit:string,category:string}> */
    public function all(): array
    {
        return array_map(self::present(...), $this->owned('ingredients')->orderBy('name')->get()->all());
    }

    /** @param array<string, mixed> $body */
    public function create(array $body): array
    {
        $row = [
            'id' => Input::newId($body),
            'user_id' => Database::USER_ID,
            'name' => Input::str($body, 'name', 120),
            'default_unit' => Input::oneOf($body, 'default_unit', self::UNITS),
            'category' => Input::str($body, 'category', 60),
        ];
        $this->db->table('ingredients')->insert($row);

        return self::present((object) $row);
    }

    /** @param array<string, mixed> $body */
    public function update(string $id, array $body): array
    {
        $this->find($id);
        $columns = [];
        if (array_key_exists('name', $body)) {
            $columns['name'] = Input::str($body, 'name', 120);
        }
        if (array_key_exists('default_unit', $body)) {
            $columns['default_unit'] = Input::oneOf($body, 'default_unit', self::UNITS);
        }
        if (array_key_exists('category', $body)) {
            $columns['category'] = Input::str($body, 'category', 60);
        }
        if ($columns !== []) {
            $this->owned('ingredients')->where('id', $id)->update($columns);
        }

        return self::present($this->find($id));
    }

    /** Fails with a 409 (foreign key) while a recipe or pantry item still uses the ingredient. */
    public function delete(string $id): void
    {
        $this->find($id);
        $this->owned('ingredients')->where('id', $id)->delete();
    }

    private function find(string $id): object
    {
        $row = $this->owned('ingredients')->where('id', $id)->first();
        if ($row === null) {
            throw ApiError::notFound();
        }

        return $row;
    }

    private static function present(object $row): array
    {
        return ['id' => $row->id, 'name' => $row->name, 'default_unit' => $row->default_unit, 'category' => $row->category];
    }
}
