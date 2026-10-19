<?php
declare(strict_types=1);

final class PantryApiTest extends ApiTestCase
{
    private function addItem(string $ingredientId, float $quantity, ?float $maxStock = null): array
    {
        $body = ['ingredientId' => $ingredientId, 'quantity' => $quantity] + ($maxStock === null ? [] : ['maxStock' => $maxStock]);
        [$status, $item] = $this->call('POST', '/api/pantry', $body);
        $this->assertSame(201, $status);

        return $item;
    }

    public function testCreateDefaultsMaxStockToTripleQuantityWithFloorOfOne(): void
    {
        $item = $this->addItem($this->makeIngredient('múka'), 200);
        $this->assertEquals(600, $item['maxStock']);
        $this->assertEquals(200, $item['quantity']);

        $tiny = $this->addItem($this->makeIngredient('soľ'), 0.1);
        $this->assertEquals(1, $tiny['maxStock']);
    }

    public function testCreateKeepsExplicitMaxStockAndListReturnsItems(): void
    {
        $item = $this->addItem($this->makeIngredient('cukor'), 100, 500);

        $this->assertEquals(500, $item['maxStock']);
        [$status, $list] = $this->call('GET', '/api/pantry');
        $this->assertSame(200, $status);
        $this->assertSame([$item['id']], array_column($list, 'id'));
    }

    public function testUpdateIsPartial(): void
    {
        $item = $this->addItem($this->makeIngredient('ryža'), 100, 400);

        [$status, $updated] = $this->call('PUT', '/api/pantry/' . $item['id'], ['quantity' => 50]);

        $this->assertSame(200, $status);
        $this->assertEquals(50, $updated['quantity']);
        $this->assertEquals(400, $updated['maxStock']);
        $this->assertSame($item['ingredientId'], $updated['ingredientId']);
    }

    public function testUpdateAndDeleteOfMissingItemAre404(): void
    {
        $missing = '11111111-2222-4333-8444-555555555555';
        $this->assertSame([404, ['error' => 'not_found']], $this->call('PUT', "/api/pantry/$missing", ['quantity' => 1]));
        $this->assertSame([404, ['error' => 'not_found']], $this->call('DELETE', "/api/pantry/$missing"));
    }

    public function testDelete(): void
    {
        $item = $this->addItem($this->makeIngredient('olej'), 1);

        $this->assertSame([204, null], $this->call('DELETE', '/api/pantry/' . $item['id']));
        $this->assertSame([200, []], $this->call('GET', '/api/pantry'));
    }

    public function testUnknownIngredientIsAConflict(): void
    {
        $this->assertSame([409, ['error' => 'conflict']], $this->call('POST', '/api/pantry', [
            'ingredientId' => '11111111-2222-4333-8444-555555555555', 'quantity' => 1,
        ]));
    }

    public function testAdjustAppliesDeltasClampsAtZeroAndSkipsUnmatched(): void
    {
        $flour = $this->makeIngredient('múka');
        $sugar = $this->makeIngredient('cukor');
        $salt = $this->makeIngredient('soľ'); // not in the pantry
        $flourItem = $this->addItem($flour, 500);
        $sugarItem = $this->addItem($sugar, 100);

        [$status, $changed] = $this->call('PUT', '/api/pantry/batch', ['deltas' => [
            ['ingredientId' => $flour, 'delta' => -200],
            ['ingredientId' => $sugar, 'delta' => -999],
            ['ingredientId' => $salt, 'delta' => -1],
        ]]);

        $this->assertSame(200, $status);
        $byId = array_column($changed, null, 'id');
        $this->assertCount(2, $byId);
        $this->assertEquals(300, $byId[$flourItem['id']]['quantity']);
        $this->assertEquals(0, $byId[$sugarItem['id']]['quantity']);
    }

    public function testAdjustWithPositiveDeltaRestocks(): void
    {
        $flour = $this->makeIngredient('múka');
        $item = $this->addItem($flour, 100);

        [, $changed] = $this->call('PUT', '/api/pantry/batch', ['deltas' => [['ingredientId' => $flour, 'delta' => 50]]]);

        $this->assertEquals(150, $changed[0]['quantity']);
        $this->assertSame($item['id'], $changed[0]['id']);
    }

    public function testAdjustWithAnInvalidDeltaChangesNothing(): void
    {
        $flour = $this->makeIngredient('múka');
        $item = $this->addItem($flour, 500);

        $result = $this->call('PUT', '/api/pantry/batch', ['deltas' => [
            ['ingredientId' => $flour, 'delta' => -100],
            ['ingredientId' => $flour, 'delta' => 'lots'],
        ]]);

        $this->assertSame([422, ['error' => 'invalid']], $result);
        $this->assertEquals(500, $this->call('GET', '/api/pantry')[1][0]['quantity']);
        $this->assertSame($item['id'], $this->call('GET', '/api/pantry')[1][0]['id']);
    }

    public function testAdjustWithNoMatchesReturnsAnEmptyList(): void
    {
        $this->assertSame([200, []], $this->call('PUT', '/api/pantry/batch', ['deltas' => []]));
    }
}
