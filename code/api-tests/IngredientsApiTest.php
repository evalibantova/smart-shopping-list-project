<?php
declare(strict_types=1);

final class IngredientsApiTest extends ApiTestCase
{
    public function testListStartsEmpty(): void
    {
        $this->assertSame([200, []], $this->call('GET', '/api/ingredients'));
    }

    public function testCreateReturnsTheEntryWithGeneratedId(): void
    {
        [$status, $row] = $this->call('POST', '/api/ingredients', [
            'name' => 'zemiak', 'default_unit' => 'g', 'category' => 'Produce',
        ]);

        $this->assertSame(201, $status);
        $this->assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', $row['id']);
        $this->assertSame(['id' => $row['id'], 'name' => 'zemiak', 'default_unit' => 'g', 'category' => 'Produce'], $row);
        $this->assertSame([200, [$row]], $this->call('GET', '/api/ingredients'));
    }

    public function testCreateKeepsAClientSuppliedId(): void
    {
        $id = '11111111-2222-4333-8444-555555555555';
        [, $row] = $this->call('POST', '/api/ingredients', [
            'id' => $id, 'name' => 'cibuľa', 'default_unit' => 'pcs', 'category' => 'Produce',
        ]);

        $this->assertSame($id, $row['id']);
    }

    public function testRejectsAnInvalidUnit(): void
    {
        $this->assertSame([422, ['error' => 'invalid']], $this->call('POST', '/api/ingredients', [
            'name' => 'x', 'default_unit' => 'stone', 'category' => 'Other',
        ]));
    }

    public function testRejectsAMissingName(): void
    {
        $this->assertSame([422, ['error' => 'invalid']], $this->call('POST', '/api/ingredients', [
            'default_unit' => 'g', 'category' => 'Other',
        ]));
    }

    public function testRejectsAMalformedId(): void
    {
        $this->assertSame([422, ['error' => 'invalid']], $this->call('POST', '/api/ingredients', [
            'id' => 'not-a-uuid', 'name' => 'x', 'default_unit' => 'g', 'category' => 'Other',
        ]));
    }

    public function testDuplicateNameIsAConflict(): void
    {
        $this->makeIngredient('soľ');

        $this->assertSame([409, ['error' => 'conflict']], $this->call('POST', '/api/ingredients', [
            'name' => 'soľ', 'default_unit' => 'g', 'category' => 'Other',
        ]));
    }

    public function testUpdateIsPartial(): void
    {
        $id = $this->makeIngredient('zemiak');

        [$status, $row] = $this->call('PUT', "/api/ingredients/$id", ['category' => 'Produce', 'default_unit' => 'kg']);

        $this->assertSame(200, $status);
        $this->assertSame(['id' => $id, 'name' => 'zemiak', 'default_unit' => 'kg', 'category' => 'Produce'], $row);
    }

    public function testUpdateRejectsAnInvalidUnitAndMissingIngredient(): void
    {
        $id = $this->makeIngredient('zemiak');

        $this->assertSame([422, ['error' => 'invalid']], $this->call('PUT', "/api/ingredients/$id", ['default_unit' => 'stone']));
        $this->assertSame([404, ['error' => 'not_found']], $this->call('PUT', '/api/ingredients/11111111-2222-4333-8444-555555555555', ['name' => 'x']));
    }

    public function testRenamingToAnExistingNameIsAConflict(): void
    {
        $this->makeIngredient('soľ');
        $id = $this->makeIngredient('cukor');

        $this->assertSame([409, ['error' => 'conflict']], $this->call('PUT', "/api/ingredients/$id", ['name' => 'soľ']));
    }

    public function testDeleteRemovesAnUnusedIngredient(): void
    {
        $id = $this->makeIngredient('zemiak');

        $this->assertSame([204, null], $this->call('DELETE', "/api/ingredients/$id"));
        $this->assertSame([200, []], $this->call('GET', '/api/ingredients'));
        $this->assertSame([404, ['error' => 'not_found']], $this->call('DELETE', "/api/ingredients/$id"));
    }

    public function testUnknownRouteIs404Json(): void
    {
        $this->assertSame([404, ['error' => 'not_found']], $this->call('GET', '/api/nope'));
    }

    public function testWrongMethodIs405Json(): void
    {
        $this->assertSame([405, ['error' => 'bad_method']], $this->call('DELETE', '/api/ingredients'));
    }
}
