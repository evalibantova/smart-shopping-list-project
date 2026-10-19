<?php
declare(strict_types=1);

namespace MealPlanner\Api;

final class PantryRepository extends Repository
{
    /** @return list<array{id:string,ingredientId:string,quantity:float,maxStock:float}> */
    public function all(): array
    {
        return array_map(self::present(...), $this->owned('pantry_items')->orderBy('id')->get()->all());
    }

    /** @param array<string, mixed> $body */
    public function create(array $body): array
    {
        $quantity = Input::number($body, 'quantity');
        $row = [
            'id' => Input::newId($body),
            'user_id' => Database::USER_ID,
            'ingredient_id' => Input::id($body, 'ingredientId'),
            'quantity' => $quantity,
            'max_stock' => array_key_exists('maxStock', $body) ? Input::number($body, 'maxStock') : max(1.0, $quantity * 3),
        ];
        $this->db->table('pantry_items')->insert($row);

        return self::present((object) $row);
    }

    /** @param array<string, mixed> $body */
    public function update(string $id, array $body): array
    {
        $this->find($id);
        $columns = [];
        if (array_key_exists('ingredientId', $body)) {
            $columns['ingredient_id'] = Input::id($body, 'ingredientId');
        }
        if (array_key_exists('quantity', $body)) {
            $columns['quantity'] = Input::number($body, 'quantity');
        }
        if (array_key_exists('maxStock', $body)) {
            $columns['max_stock'] = Input::number($body, 'maxStock');
        }
        if ($columns !== []) {
            $this->owned('pantry_items')->where('id', $id)->update($columns);
        }

        return self::present($this->find($id));
    }

    public function delete(string $id): void
    {
        $this->find($id);
        $this->owned('pantry_items')->where('id', $id)->delete();
    }

    /**
     * Applies quantity deltas keyed by ingredient, clamped at 0, in one transaction.
     * Deltas for ingredients without a pantry item are skipped (same as the old client-side batch).
     *
     * @param array<string, mixed> $body {"deltas":[{"ingredientId":string,"delta":number}]}
     * @return list<array<string, mixed>> the items that changed
     */
    public function adjust(array $body): array
    {
        $deltas = $body['deltas'] ?? null;
        if (!is_array($deltas) || !array_is_list($deltas)) {
            throw ApiError::invalid();
        }
        $parsed = array_map(function ($line) {
            if (!is_array($line) || (!is_int($line['delta'] ?? null) && !is_float($line['delta'] ?? null))) {
                throw ApiError::invalid();
            }

            return ['ingredientId' => Input::id($line, 'ingredientId'), 'delta' => (float) $line['delta']];
        }, $deltas); // validate everything before touching the database

        return $this->db->transaction(function () use ($parsed) {
            $changed = [];
            foreach ($parsed as ['ingredientId' => $ingredientId, 'delta' => $delta]) {
                $item = $this->owned('pantry_items')->where('ingredient_id', $ingredientId)->orderBy('id')->first();
                if ($item === null) {
                    continue;
                }
                $item->quantity = max(0.0, (float) $item->quantity + $delta);
                $this->owned('pantry_items')->where('id', $item->id)->update(['quantity' => $item->quantity]);
                $changed[$item->id] = self::present($item); // later deltas for the same item overwrite earlier ones
            }

            return array_values($changed);
        });
    }

    private function find(string $id): object
    {
        $row = $this->owned('pantry_items')->where('id', $id)->first();
        if ($row === null) {
            throw ApiError::notFound();
        }

        return $row;
    }

    private static function present(object $row): array
    {
        return [
            'id' => $row->id,
            'ingredientId' => $row->ingredient_id,
            'quantity' => (float) $row->quantity,
            'maxStock' => (float) $row->max_stock,
        ];
    }
}
