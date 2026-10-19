<?php
declare(strict_types=1);

final class MealPlanApiTest extends ApiTestCase
{
    private function makeRecipe(): string
    {
        [, $recipe] = $this->call('POST', '/api/recipes', ['emoji' => '🍲', 'name' => 'Guláš', 'servings' => 4]);

        return $recipe['id'];
    }

    private function addEntry(string $recipeId, array $overrides = []): array
    {
        [$status, $entry] = $this->call('POST', '/api/meal-plan', $overrides + [
            'date' => '2026-10-20', 'slot' => 'dinner', 'recipeId' => $recipeId, 'servings' => 2,
        ]);
        $this->assertSame(201, $status);

        return $entry;
    }

    public function testCreateReturnsTheEntryNotCooked(): void
    {
        $recipeId = $this->makeRecipe();
        $entry = $this->addEntry($recipeId);

        $this->assertSame(['id' => $entry['id'], 'date' => '2026-10-20', 'slot' => 'dinner', 'recipeId' => $recipeId, 'servings' => 2, 'cooked' => false], $entry);
        $this->assertSame([200, [$entry]], $this->call('GET', '/api/meal-plan'));
    }

    public function testUpdateIsPartialAndCanMarkCooked(): void
    {
        $entry = $this->addEntry($this->makeRecipe());

        [$status, $updated] = $this->call('PUT', '/api/meal-plan/' . $entry['id'], ['cooked' => true, 'servings' => 5]);

        $this->assertSame(200, $status);
        $this->assertTrue($updated['cooked']);
        $this->assertSame(5, $updated['servings']);
        $this->assertSame('2026-10-20', $updated['date']);
    }

    public function testUpdateAndDeleteOfMissingEntryAre404(): void
    {
        $missing = '11111111-2222-4333-8444-555555555555';
        $this->assertSame([404, ['error' => 'not_found']], $this->call('PUT', "/api/meal-plan/$missing", ['cooked' => true]));
        $this->assertSame([404, ['error' => 'not_found']], $this->call('DELETE', "/api/meal-plan/$missing"));
    }

    public function testDelete(): void
    {
        $entry = $this->addEntry($this->makeRecipe());

        $this->assertSame([204, null], $this->call('DELETE', '/api/meal-plan/' . $entry['id']));
        $this->assertSame([200, []], $this->call('GET', '/api/meal-plan'));
    }

    public function testDeletingARecipeRemovesItsPlannedMeals(): void
    {
        $recipeId = $this->makeRecipe();
        $this->addEntry($recipeId);

        $this->call('DELETE', "/api/recipes/$recipeId");

        $this->assertSame([200, []], $this->call('GET', '/api/meal-plan'));
    }

    public function testValidation(): void
    {
        $recipeId = $this->makeRecipe();
        $base = ['date' => '2026-10-20', 'slot' => 'dinner', 'recipeId' => $recipeId, 'servings' => 2];

        $this->assertSame(422, $this->call('POST', '/api/meal-plan', ['slot' => 'brunch'] + $base)[0]);
        $this->assertSame(422, $this->call('POST', '/api/meal-plan', ['date' => '2026-02-30'] + $base)[0]);
        $this->assertSame(422, $this->call('POST', '/api/meal-plan', ['date' => '20/10/2026'] + $base)[0]);
        $this->assertSame(422, $this->call('POST', '/api/meal-plan', ['servings' => 0] + $base)[0]);
        $this->assertSame(422, $this->call('POST', '/api/meal-plan', ['recipeId' => 'bad'] + $base)[0]);
    }

    public function testUnknownRecipeIsAConflict(): void
    {
        $this->assertSame([409, ['error' => 'conflict']], $this->call('POST', '/api/meal-plan', [
            'date' => '2026-10-20', 'slot' => 'lunch', 'recipeId' => '11111111-2222-4333-8444-555555555555', 'servings' => 1,
        ]));
    }

    public function testServingsAboveTheUpperBoundIsInvalid(): void
    {
        $recipeId = $this->makeRecipe();

        $this->assertSame(422, $this->call('POST', '/api/meal-plan', [
            'date' => '2026-10-20', 'slot' => 'dinner', 'recipeId' => $recipeId, 'servings' => 1_000_001,
        ])[0]);
    }
}
