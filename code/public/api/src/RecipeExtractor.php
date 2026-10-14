<?php
// code/public/api/src/RecipeExtractor.php
declare(strict_types=1);

namespace MealPlanner\Api;

final class RecipeExtractor
{
    public const TEXT_LIMIT = 6000;

    private const NOISE = ['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript', 'form', 'svg', 'iframe', 'button', 'template'];

    /**
     * Prefer the page's schema.org Recipe JSON-LD (compacted); otherwise return capped visible text.
     *
     * @return array{source: string, text: string}
     */
    public static function extract(string $html): array
    {
        $doc = self::load($html);

        $recipe = self::findJsonLdRecipe($doc);
        if ($recipe !== null) {
            return [
                'source' => 'jsonld',
                'text' => json_encode(self::compact($recipe), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            ];
        }

        $text = self::visibleText($doc);
        if ($text === '') {
            throw new FetchError('no_content');
        }

        return ['source' => 'text', 'text' => $text];
    }

    private static function load(string $html): \DOMDocument
    {
        $doc = new \DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="utf-8" ?>' . $html, LIBXML_NOERROR | LIBXML_NOWARNING | LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        return $doc;
    }

    private static function findJsonLdRecipe(\DOMDocument $doc): ?array
    {
        $nodes = (new \DOMXPath($doc))->query('//script[@type="application/ld+json"]');
        foreach ($nodes ?: [] as $node) {
            $data = json_decode(trim($node->textContent), true);
            if (!is_array($data)) {
                continue;
            }
            $found = self::searchRecipe($data);
            if ($found !== null) {
                return $found;
            }
        }

        return null;
    }

    private static function searchRecipe(array $node): ?array
    {
        $type = $node['@type'] ?? null;
        $types = is_array($type) ? $type : [$type];
        if (in_array('Recipe', $types, true)) {
            return $node;
        }
        foreach ($node as $child) {
            if (is_array($child)) {
                $found = self::searchRecipe($child);
                if ($found !== null) {
                    return $found;
                }
            }
        }

        return null;
    }

    private static function compact(array $recipe): array
    {
        $out = [];
        foreach (['name', 'recipeYield'] as $key) {
            if (isset($recipe[$key])) {
                $out[$key] = $recipe[$key];
            }
        }
        if (isset($recipe['recipeIngredient'])) {
            $out['recipeIngredient'] = array_values((array) $recipe['recipeIngredient']);
        }
        if (isset($recipe['recipeInstructions'])) {
            $steps = self::flattenInstructions($recipe['recipeInstructions']);
            $out['recipeInstructions'] = array_values(array_filter($steps, fn (string $s): bool => $s !== ''));
        }

        return $out;
    }

    /** @return list<string> */
    private static function flattenInstructions(mixed $node): array
    {
        if (is_string($node)) {
            return [trim(strip_tags($node))];
        }
        if (!is_array($node)) {
            return [];
        }
        if (isset($node['text']) && is_string($node['text'])) {
            return [trim(strip_tags($node['text']))];
        }
        if (isset($node['itemListElement'])) {
            return self::flattenInstructions($node['itemListElement']);
        }
        if (!array_is_list($node)) {
            return [];
        }
        $steps = [];
        foreach ($node as $item) {
            $steps = [...$steps, ...self::flattenInstructions($item)];
        }

        return $steps;
    }

    private static function visibleText(\DOMDocument $doc): string
    {
        $xpath = new \DOMXPath($doc);
        foreach (self::NOISE as $tag) {
            $elements = $xpath->query('//' . $tag);
            foreach ($elements ? iterator_to_array($elements) : [] as $element) {
                $element->parentNode?->removeChild($element);
            }
        }

        $root = $xpath->query('//main')->item(0)
            ?? $xpath->query('//article')->item(0)
            ?? $doc->getElementsByTagName('body')->item(0);
        if ($root === null) {
            return '';
        }

        $text = preg_replace('/\s+/u', ' ', $root->textContent) ?? '';

        return mb_substr(trim($text), 0, self::TEXT_LIMIT);
    }
}
