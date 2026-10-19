<?php
declare(strict_types=1);

use MealPlanner\Api\CookbookData;
use PHPUnit\Framework\TestCase;

final class CookbookDataTest extends TestCase
{
    private function seed(): array
    {
        return json_decode(file_get_contents(dirname(__DIR__) . '/src/data/cookbookSeed.json'), true, 512, JSON_THROW_ON_ERROR);
    }

    private function mini(array $recipes, array $ingredients = []): array
    {
        return ['ingredients' => $ingredients ?: [['name' => 'voda', 'default_unit' => 'ml', 'category' => 'Other']], 'recipes' => $recipes];
    }

    private function recipe(string $name, string $category, ?string $mainTag = null, array $lines = []): array
    {
        return ['name' => $name, 'category' => $category, 'servings' => 2, 'notes' => '', 'mainTag' => $mainTag, 'ingredients' => $lines];
    }

    public function testConvertsTheWholeCookbook(): void
    {
        $rows = CookbookData::rows($this->seed());

        $this->assertCount(163, $rows['ingredients']);
        $this->assertCount(53, $rows['recipes']);
        $this->assertSame(['ingredients', 'tags', 'recipes', 'recipe_tags', 'recipe_ingredients'], array_keys($rows));
    }

    public function testEveryLinkResolvesToAGeneratedRow(): void
    {
        $rows = CookbookData::rows($this->seed());
        $ingredientIds = array_column($rows['ingredients'], 'id');
        $tagIds = array_column($rows['tags'], 'id');
        $recipeIds = array_column($rows['recipes'], 'id');

        foreach ($rows['recipe_ingredients'] as $line) {
            $this->assertContains($line['ingredient_id'], $ingredientIds);
            $this->assertContains($line['recipe_id'], $recipeIds);
        }
        foreach ($rows['recipe_tags'] as $link) {
            $this->assertContains($link['tag_id'], $tagIds);
            $this->assertContains($link['recipe_id'], $recipeIds);
        }
        // The seed has one recipe with neither category nor mainTag; the TS import gives it no tags either.
        $taggable = count(array_filter($this->seed()['recipes'], fn ($r) => $r['category'] || ($r['mainTag'] ?? null)));
        $this->assertSame($taggable, count(array_unique(array_column($rows['recipe_tags'], 'recipe_id'))), 'every recipe with a category or main tag is linked to its tags');
    }

    public function testEmojiFollowsCategoryThenNameKeywordThenDefault(): void
    {
        $rows = CookbookData::rows($this->mini([
            $this->recipe('Cesnaková', 'Polievka'),
            $this->recipe('Bravčový guláš', 'Iné'),
            $this->recipe('Niečo', 'Iné'),
        ]));

        $emoji = array_column($rows['recipes'], 'emoji', 'name');
        $this->assertSame('🍲', $emoji['Cesnaková']);
        $this->assertSame('🥘', $emoji['Bravčový guláš']);
        $this->assertSame('🍴', $emoji['Niečo']);
    }

    public function testTagsGetKnownColoursOrTheDefaultAndAreCreatedOnce(): void
    {
        $rows = CookbookData::rows($this->mini([
            $this->recipe('A', 'Polievka', 'bravčové'),
            $this->recipe('B', 'Polievka', 'neznáme'),
        ]));

        $colours = array_column($rows['tags'], 'color', 'name');
        $this->assertSame('#26A69A', $colours['Polievka']);
        $this->assertSame('#E57373', $colours['bravčové']);
        $this->assertSame('#9E9E9E', $colours['neznáme']);
        $this->assertCount(3, $rows['tags']);
    }

    public function testTagOrderIsCategoryThenMainTag(): void
    {
        $rows = CookbookData::rows($this->mini([$this->recipe('A', 'Polievka', 'bravčové')]));

        $names = array_column($rows['tags'], 'name', 'id');
        $links = $rows['recipe_tags'];
        $this->assertSame(['Polievka', 'bravčové'], array_map(fn ($l) => $names[$l['tag_id']], $links));
        $this->assertSame([0, 1], array_column($links, 'position'));
    }

    public function testRecipesKeepCookbookOrderViaCreatedAt(): void
    {
        $rows = CookbookData::rows($this->mini([$this->recipe('A', 'Iné'), $this->recipe('B', 'Iné')]), now: 1000);

        $this->assertSame([1000, 1001], array_column($rows['recipes'], 'created_at'));
    }

    public function testUnknownIngredientThrows(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('ghost');

        CookbookData::rows($this->mini([$this->recipe('X', 'Iné', null, [['ingredient' => 'ghost', 'quantity' => 1]])]));
    }
}
