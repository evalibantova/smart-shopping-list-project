<?php
declare(strict_types=1);

namespace MealPlanner\Api;

final class TagRepository extends Repository
{
    /** @return list<array{id:string,name:string,color:string}> */
    public function all(): array
    {
        return array_map(self::present(...), $this->owned('tags')->orderBy('name')->get()->all());
    }

    /** @param array<string, mixed> $body */
    public function create(array $body): array
    {
        $row = [
            'id' => Input::newId($body),
            'user_id' => Database::USER_ID,
            'name' => Input::str($body, 'name', 60),
            'color' => Input::str($body, 'color', 16),
        ];
        $this->db->table('tags')->insert($row);

        return self::present((object) $row);
    }

    /** @param array<string, mixed> $body */
    public function update(string $id, array $body): array
    {
        $this->find($id);
        $columns = [];
        if (array_key_exists('name', $body)) {
            $columns['name'] = Input::str($body, 'name', 60);
        }
        if (array_key_exists('color', $body)) {
            $columns['color'] = Input::str($body, 'color', 16);
        }
        if ($columns !== []) {
            $this->owned('tags')->where('id', $id)->update($columns);
        }

        return self::present($this->find($id));
    }

    /** Fails with a 409 (foreign key) while a recipe still uses the tag. */
    public function delete(string $id): void
    {
        $this->find($id);
        $this->owned('tags')->where('id', $id)->delete();
    }

    private function find(string $id): object
    {
        $row = $this->owned('tags')->where('id', $id)->first();
        if ($row === null) {
            throw ApiError::notFound();
        }

        return $row;
    }

    private static function present(object $row): array
    {
        return ['id' => $row->id, 'name' => $row->name, 'color' => $row->color];
    }
}
