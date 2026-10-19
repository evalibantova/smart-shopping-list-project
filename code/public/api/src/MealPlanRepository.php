<?php
declare(strict_types=1);

namespace MealPlanner\Api;

final class MealPlanRepository extends Repository
{
    public const SLOTS = ['breakfast', 'lunch', 'dinner'];

    /** @return list<array<string, mixed>> */
    public function all(): array
    {
        return array_map(self::present(...), $this->owned('meal_plan_entries')->orderBy('date')->orderBy('id')->get()->all());
    }

    /** @param array<string, mixed> $body */
    public function create(array $body): array
    {
        $row = [
            'id' => Input::newId($body),
            'user_id' => Database::USER_ID,
            'date' => Input::date($body, 'date'),
            'slot' => Input::oneOf($body, 'slot', self::SLOTS),
            'recipe_id' => Input::id($body, 'recipeId'),
            'servings' => Input::integer($body, 'servings', 1),
            'cooked' => array_key_exists('cooked', $body) ? Input::boolean($body, 'cooked') : false,
        ];
        $this->db->table('meal_plan_entries')->insert($row);

        return self::present((object) $row);
    }

    /** @param array<string, mixed> $body */
    public function update(string $id, array $body): array
    {
        $this->find($id);
        $columns = [];
        if (array_key_exists('date', $body)) {
            $columns['date'] = Input::date($body, 'date');
        }
        if (array_key_exists('slot', $body)) {
            $columns['slot'] = Input::oneOf($body, 'slot', self::SLOTS);
        }
        if (array_key_exists('recipeId', $body)) {
            $columns['recipe_id'] = Input::id($body, 'recipeId');
        }
        if (array_key_exists('servings', $body)) {
            $columns['servings'] = Input::integer($body, 'servings', 1);
        }
        if (array_key_exists('cooked', $body)) {
            $columns['cooked'] = Input::boolean($body, 'cooked');
        }
        if ($columns !== []) {
            $this->owned('meal_plan_entries')->where('id', $id)->update($columns);
        }

        return self::present($this->find($id));
    }

    public function delete(string $id): void
    {
        $this->find($id);
        $this->owned('meal_plan_entries')->where('id', $id)->delete();
    }

    private function find(string $id): object
    {
        $row = $this->owned('meal_plan_entries')->where('id', $id)->first();
        if ($row === null) {
            throw ApiError::notFound();
        }

        return $row;
    }

    private static function present(object $row): array
    {
        return [
            'id' => $row->id,
            'date' => $row->date,
            'slot' => $row->slot,
            'recipeId' => $row->recipe_id,
            'servings' => (int) $row->servings,
            'cooked' => (bool) $row->cooked,
        ];
    }
}
