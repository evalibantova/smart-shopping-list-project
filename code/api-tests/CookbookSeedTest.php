<?php
declare(strict_types=1);

final class CookbookSeedTest extends ApiTestCase
{
    public function testSeederLoadsTheCookbookThroughTheApi(): void
    {
        $this->testDb->seed();

        $this->assertCount(163, $this->call('GET', '/api/ingredients')[1]);
        $recipes = $this->call('GET', '/api/recipes')[1];
        $this->assertCount(53, $recipes);
        $this->assertNotEmpty($recipes[0]['ingredients']);
        $this->assertNotEmpty($recipes[0]['tagIds']);
    }

    public function testSeedingTwiceDoesNotDuplicate(): void
    {
        $this->testDb->seed();
        $this->testDb->seed();

        $this->assertCount(163, $this->call('GET', '/api/ingredients')[1]);
        $this->assertCount(53, $this->call('GET', '/api/recipes')[1]);
    }

    public function testSeederLeavesAnExistingDatabaseAlone(): void
    {
        $this->makeIngredient('moja surovina');

        $this->testDb->seed();

        $this->assertCount(1, $this->call('GET', '/api/ingredients')[1]);
        $this->assertSame([200, []], $this->call('GET', '/api/recipes'));
    }
}
