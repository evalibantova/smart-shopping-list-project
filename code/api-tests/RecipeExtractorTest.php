<?php
// code/api-tests/RecipeExtractorTest.php
declare(strict_types=1);

use MealPlanner\Api\FetchError;
use MealPlanner\Api\RecipeExtractor;
use PHPUnit\Framework\TestCase;

final class RecipeExtractorTest extends TestCase
{
    private static function page(string $ldJson = '', string $body = '<p>x</p>'): string
    {
        $ld = $ldJson === '' ? '' : '<script type="application/ld+json">' . $ldJson . '</script>';
        return '<html><head>' . $ld . '</head><body>' . $body . '</body></html>';
    }

    private static function recipeOf(array $result): array
    {
        return json_decode($result['text'], true, 512, JSON_THROW_ON_ERROR);
    }

    public function testExtractsABareRecipeAndKeepsOnlyTheUsefulKeys(): void
    {
        $ld = '{"@context":"https://schema.org","@type":"Recipe","name":"Pancakes","recipeYield":"4",'
            . '"image":"x.jpg","description":"Long text","recipeIngredient":["200 g flour","2 eggs"],'
            . '"recipeInstructions":"Mix.<br>Fry."}';
        $result = RecipeExtractor::extract(self::page($ld));

        $this->assertSame('jsonld', $result['source']);
        $recipe = self::recipeOf($result);
        $this->assertSame('Pancakes', $recipe['name']);
        $this->assertSame(['200 g flour', '2 eggs'], $recipe['recipeIngredient']);
        $this->assertSame(['Mix.Fry.'], $recipe['recipeInstructions']);
        $this->assertArrayNotHasKey('image', $recipe);
        $this->assertArrayNotHasKey('description', $recipe);
    }

    public function testFindsARecipeInsideAGraph(): void
    {
        $ld = '{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Blog"},'
            . '{"@type":"Recipe","name":"Soup","recipeIngredient":["1 onion"]}]}';
        $recipe = self::recipeOf(RecipeExtractor::extract(self::page($ld)));
        $this->assertSame('Soup', $recipe['name']);
    }

    public function testAcceptsATypeArray(): void
    {
        $ld = '{"@type":["Recipe","NewsArticle"],"name":"Stew","recipeIngredient":["1 pot"]}';
        $this->assertSame('Stew', self::recipeOf(RecipeExtractor::extract(self::page($ld)))['name']);
    }

    public function testFlattensHowToStepsAndSectionsWithoutLeakingTypes(): void
    {
        $ld = '{"@type":"Recipe","name":"Bread","recipeInstructions":['
            . '{"@type":"HowToSection","name":"Dough","itemListElement":['
            . '{"@type":"HowToStep","text":"Knead."},{"@type":"HowToStep","text":"Rest."}]},'
            . '{"@type":"HowToStep","text":"Bake."}]}';
        $recipe = self::recipeOf(RecipeExtractor::extract(self::page($ld)));
        $this->assertSame(['Knead.', 'Rest.', 'Bake.'], $recipe['recipeInstructions']);
    }

    public function testKeepsUnicodeUnescaped(): void
    {
        $ld = '{"@type":"Recipe","name":"Múčnik","recipeIngredient":["200 g múky"]}';
        $this->assertStringContainsString('Múčnik', RecipeExtractor::extract(self::page($ld))['text']);
    }

    public function testFallsBackToTextWhenJsonLdIsBrokenOrHasNoRecipe(): void
    {
        $result = RecipeExtractor::extract(self::page('{not json', '<main>Real content here</main>'));
        $this->assertSame('text', $result['source']);
        $this->assertSame('Real content here', $result['text']);
    }

    public function testTextFallbackStripsNoiseCollapsesWhitespaceAndPrefersMain(): void
    {
        $html = '<html><body><nav>Menu Home</nav><header>Logo</header>'
            . '<main><h1>Soup</h1>   <p>Boil   water.</p><script>evil()</script></main>'
            . '<aside>Ads</aside><footer>Copyright</footer></body></html>';
        $result = RecipeExtractor::extract($html);
        $this->assertSame('text', $result['source']);
        $this->assertSame('Soup Boil water.', $result['text']);
    }

    public function testTextFallbackUsesTheBodyWhenThereIsNoMainOrArticle(): void
    {
        $result = RecipeExtractor::extract('<html><body><nav>Menu</nav><div>Boil water.</div></body></html>');
        $this->assertSame('Boil water.', $result['text']);
    }

    public function testTextFallbackSeparatesBlockElements(): void
    {
        $result = RecipeExtractor::extract('<html><body><main><ul><li>200 g flour</li><li>2 eggs</li></ul></main></body></html>');
        $this->assertStringContainsString('200 g flour 2 eggs', $result['text']);
    }

    public function testTextFallbackReadsContentWrappedInAForm(): void
    {
        $result = RecipeExtractor::extract('<html><body><form><main>Boil water.</main></form></body></html>');
        $this->assertSame('Boil water.', $result['text']);
    }

    public function testTextFallbackIsCapped(): void
    {
        $result = RecipeExtractor::extract('<html><body><main>' . str_repeat('word ', 5000) . '</main></body></html>');
        $this->assertLessThanOrEqual(RecipeExtractor::TEXT_LIMIT, mb_strlen($result['text']));
    }

    public function testThrowsNoContentWhenNothingIsReadable(): void
    {
        try {
            RecipeExtractor::extract('<html><body><script>x()</script><nav>Menu</nav></body></html>');
            $this->fail('expected FetchError');
        } catch (FetchError $e) {
            $this->assertSame('no_content', $e->errorCode);
        }
    }
}
