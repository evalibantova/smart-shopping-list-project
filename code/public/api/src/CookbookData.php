<?php
declare(strict_types=1);

namespace MealPlanner\Api;

/** PHP port of src/data/cookbookImport.ts: turns cookbookSeed.json into rows per table. No database access. */
final class CookbookData
{
    private const CATEGORY_EMOJI = [
        'Polievka' => '🍲',
        'Dezert' => '🍰',
        'Hlavné jedlo' => '🍽️',
        'Príloha' => '🥔',
        'Snack' => '🥨',
    ];
    private const DEFAULT_EMOJI = '🍴';
    /** Fallback when the category has no emoji: the first keyword found in the name wins. */
    private const NAME_EMOJI = [
        'medovník' => '🍪',
        'guláš' => '🥘',
        'rebierka' => '🍖',
        'šalát' => '🥗',
        'halušky' => '🥟',
        'csalamádé' => '🫑',
    ];
    private const DEFAULT_TAG_COLOR = '#9E9E9E';
    private const TAG_COLORS = [
        'Polievka' => '#26A69A',
        'Dezert' => '#F06292',
        'Hlavné jedlo' => '#5C6BC0',
        'Príloha' => '#D4E157',
        'Snack' => '#FFCA28',
        'Iné' => '#BDBDBD',
        'bravčové' => '#E57373',
        'kuracie' => '#FFB74D',
        'hovädzie' => '#B71C1C',
        'zemiaky' => '#C9A66B',
        'kapusta' => '#66BB6A',
        'fazuľa' => '#AD1457',
        'šošovica' => '#9CCC65',
        'huby' => '#8D6E63',
        'ryža' => '#90A4AE',
        'paradajky' => '#FF7043',
        'baklažán' => '#5E35B1',
        'mušle' => '#29B6F6',
    ];

    /**
     * @param array{ingredients: list<array<string,mixed>>, recipes: list<array<string,mixed>>} $seed
     * @param ?int $now epoch milliseconds for the first recipe's created_at (defaults to the current time)
     * @return array<string, list<array<string,mixed>>> rows keyed by table, in foreign-key-safe insert order
     * @throws \RuntimeException when a recipe names an ingredient that is not in the seed
     */
    public static function rows(array $seed, ?int $now = null): array
    {
        $now ??= (int) round(microtime(true) * 1000);

        $ingredients = [];
        $ingredientIds = [];
        foreach ($seed['ingredients'] as $ingredient) {
            if (isset($ingredientIds[$ingredient['name']])) {
                continue;
            }
            $ingredientIds[$ingredient['name']] = Uuid::v4();
            $ingredients[] = [
                'id' => $ingredientIds[$ingredient['name']],
                'user_id' => Database::USER_ID,
                'name' => $ingredient['name'],
                'default_unit' => $ingredient['default_unit'],
                'category' => $ingredient['category'],
            ];
        }

        $tags = [];
        $tagIds = [];
        $recipes = [];
        $recipeTags = [];
        $recipeIngredients = [];
        foreach ($seed['recipes'] as $index => $recipe) {
            $recipeId = Uuid::v4();
            $recipes[] = [
                'id' => $recipeId,
                'user_id' => Database::USER_ID,
                'emoji' => self::emojiFor($recipe['name'], $recipe['category']),
                'name' => $recipe['name'],
                'servings' => $recipe['servings'],
                'notes' => $recipe['notes'],
                'created_at' => $now + $index, // keeps the cookbook's order
            ];

            foreach (array_values(array_filter([$recipe['category'], $recipe['mainTag'] ?? null])) as $position => $tagName) {
                if (!isset($tagIds[$tagName])) {
                    $tagIds[$tagName] = Uuid::v4();
                    $tags[] = [
                        'id' => $tagIds[$tagName],
                        'user_id' => Database::USER_ID,
                        'name' => $tagName,
                        'color' => self::TAG_COLORS[$tagName] ?? self::DEFAULT_TAG_COLOR,
                    ];
                }
                $recipeTags[] = ['recipe_id' => $recipeId, 'tag_id' => $tagIds[$tagName], 'position' => $position];
            }

            foreach ($recipe['ingredients'] as $position => $line) {
                $ingredientId = $ingredientIds[$line['ingredient']] ?? null;
                if ($ingredientId === null) {
                    throw new \RuntimeException('Unknown ingredient in cookbook seed: ' . $line['ingredient']);
                }
                $recipeIngredients[] = [
                    'recipe_id' => $recipeId,
                    'position' => $position,
                    'ingredient_id' => $ingredientId,
                    'quantity' => $line['quantity'],
                ];
            }
        }

        return [
            'ingredients' => $ingredients,
            'tags' => $tags,
            'recipes' => $recipes,
            'recipe_tags' => $recipeTags,
            'recipe_ingredients' => $recipeIngredients,
        ];
    }

    private static function emojiFor(string $name, string $category): string
    {
        if (isset(self::CATEGORY_EMOJI[$category])) {
            return self::CATEGORY_EMOJI[$category];
        }
        $lower = mb_strtolower($name);
        foreach (self::NAME_EMOJI as $keyword => $emoji) {
            if (str_contains($lower, $keyword)) {
                return $emoji;
            }
        }

        return self::DEFAULT_EMOJI;
    }
}
