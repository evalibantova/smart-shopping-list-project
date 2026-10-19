<?php
declare(strict_types=1);

final class RecipesApiTest extends ApiTestCase
{
    private int $seq = 0;

    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'emoji' => '🍲',
            'name' => 'Kapustnica',
            'servings' => 4,
            'tagIds' => [$this->makeTag('Polievka ' . ++$this->seq)],
            'ingredients' => [['ingredientId' => $this->makeIngredient('kapusta ' . $this->seq), 'quantity' => 500]],
            'notes' => 'Varíme dlho.',
        ];
    }

    public function testCreateReturnsTheFullRecipe(): void
    {
        $body = $this->payload();
        [$status, $recipe] = $this->call('POST', '/api/recipes', $body);

        $this->assertSame(201, $status);
        $this->assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', $recipe['id']);
        $this->assertSame('Kapustnica', $recipe['name']);
        $this->assertSame(4, $recipe['servings']);
        $this->assertSame($body['tagIds'], $recipe['tagIds']);
        $this->assertEquals($body['ingredients'], $recipe['ingredients']);
        $this->assertSame('Varíme dlho.', $recipe['notes']);
        $this->assertIsInt($recipe['createdAt']);
        $this->assertEqualsWithDelta(time() * 1000, $recipe['createdAt'], 60_000);
    }

    public function testListReturnsCreatedRecipesOldestFirst(): void
    {
        [, $a] = $this->call('POST', '/api/recipes', $this->payload(['name' => 'A']));
        [, $b] = $this->call('POST', '/api/recipes', $this->payload(['name' => 'B', 'tagIds' => [], 'ingredients' => []]));

        [$status, $list] = $this->call('GET', '/api/recipes');

        $this->assertSame(200, $status);
        $this->assertSame([$a['id'], $b['id']], array_column($list, 'id'));
        $this->assertSame([], $list[1]['tagIds']);
        $this->assertSame([], $list[1]['ingredients']);
    }

    public function testTagAndIngredientOrderIsPreserved(): void
    {
        $t1 = $this->makeTag('Zebra');
        $t2 = $this->makeTag('Alfa');
        $i1 = $this->makeIngredient('zzz');
        $i2 = $this->makeIngredient('aaa');

        [, $recipe] = $this->call('POST', '/api/recipes', $this->payload([
            'tagIds' => [$t1, $t2],
            'ingredients' => [['ingredientId' => $i1, 'quantity' => 1], ['ingredientId' => $i2, 'quantity' => 2]],
        ]));

        $this->assertSame([$t1, $t2], $recipe['tagIds']);
        $this->assertSame([$i1, $i2], array_column($recipe['ingredients'], 'ingredientId'));
    }

    public function testUpdateIsPartialAndKeepsCreatedAt(): void
    {
        [, $created] = $this->call('POST', '/api/recipes', $this->payload());

        [$status, $updated] = $this->call('PUT', '/api/recipes/' . $created['id'], ['name' => 'Kapustnica 2', 'servings' => 6]);

        $this->assertSame(200, $status);
        $this->assertSame('Kapustnica 2', $updated['name']);
        $this->assertSame(6, $updated['servings']);
        $this->assertSame($created['tagIds'], $updated['tagIds']);
        $this->assertSame($created['ingredients'], $updated['ingredients']);
        $this->assertSame($created['createdAt'], $updated['createdAt']);
    }

    public function testUpdateReplacesTagsAndIngredients(): void
    {
        [, $created] = $this->call('POST', '/api/recipes', $this->payload());
        $newTag = $this->makeTag('Dezert');
        $newIng = $this->makeIngredient('cukor');

        [, $updated] = $this->call('PUT', '/api/recipes/' . $created['id'], [
            'tagIds' => [$newTag],
            'ingredients' => [['ingredientId' => $newIng, 'quantity' => 2.5]],
        ]);

        $this->assertSame([$newTag], $updated['tagIds']);
        $this->assertEquals([['ingredientId' => $newIng, 'quantity' => 2.5]], $updated['ingredients']);
    }

    public function testUpdateOfMissingRecipeIs404(): void
    {
        $this->assertSame([404, ['error' => 'not_found']], $this->call('PUT', '/api/recipes/11111111-2222-4333-8444-555555555555', ['name' => 'x']));
    }

    public function testDeleteRemovesRecipeAndItsJoinRows(): void
    {
        [, $recipe] = $this->call('POST', '/api/recipes', $this->payload());

        $this->assertSame([204, null], $this->call('DELETE', '/api/recipes/' . $recipe['id']));
        $this->assertSame([200, []], $this->call('GET', '/api/recipes'));
        $this->assertSame(0, $this->db->table('recipe_tags')->count());
        $this->assertSame(0, $this->db->table('recipe_ingredients')->count());
    }

    public function testDeleteOfMissingRecipeIs404(): void
    {
        $this->assertSame([404, ['error' => 'not_found']], $this->call('DELETE', '/api/recipes/11111111-2222-4333-8444-555555555555'));
    }

    public function testUnknownIngredientIsAConflictAndLeavesNothingBehind(): void
    {
        $body = $this->payload(['ingredients' => [['ingredientId' => '11111111-2222-4333-8444-555555555555', 'quantity' => 1]]]);

        $this->assertSame([409, ['error' => 'conflict']], $this->call('POST', '/api/recipes', $body));
        $this->assertSame(0, $this->db->table('recipes')->count());
    }

    public function testValidation(): void
    {
        $this->assertSame(422, $this->call('POST', '/api/recipes', $this->payload(['name' => '']))[0]);
        $this->assertSame(422, $this->call('POST', '/api/recipes', $this->payload(['servings' => 0]))[0]);
        $this->assertSame(422, $this->call('POST', '/api/recipes', $this->payload(['ingredients' => [['ingredientId' => 'bad', 'quantity' => 1]]]))[0]);
        $this->assertSame(422, $this->call('POST', '/api/recipes', $this->payload(['ingredients' => [['ingredientId' => $this->makeIngredient('x'), 'quantity' => -1]]]))[0]);
    }

    public function testIngredientAndTagInUseCannotBeDeleted(): void
    {
        $body = $this->payload();
        $this->call('POST', '/api/recipes', $body);

        $this->assertSame([409, ['error' => 'conflict']], $this->call('DELETE', '/api/ingredients/' . $body['ingredients'][0]['ingredientId']));
        $this->assertSame([409, ['error' => 'conflict']], $this->call('DELETE', '/api/tags/' . $body['tagIds'][0]));
    }

    public function testNotesAndLinkListsDefaultWhenOmitted(): void
    {
        [$status, $recipe] = $this->call('POST', '/api/recipes', ['emoji' => '🍴', 'name' => 'Voda', 'servings' => 1]);

        $this->assertSame(201, $status);
        $this->assertSame('', $recipe['notes']);
        $this->assertSame([], $recipe['tagIds']);
        $this->assertSame([], $recipe['ingredients']);
    }

    public function testServingsAndNotesAboveTheirBoundsAreInvalid(): void
    {
        $this->assertSame(422, $this->call('POST', '/api/recipes', $this->payload(['servings' => 1_000_001]))[0]);
        $this->assertSame(422, $this->call('POST', '/api/recipes', $this->payload(['notes' => str_repeat('a', 20001)]))[0]);
    }
}
