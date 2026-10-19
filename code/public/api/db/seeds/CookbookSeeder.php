<?php
declare(strict_types=1);

use MealPlanner\Api\CookbookData;
use Phinx\Seed\AbstractSeed;

final class CookbookSeeder extends AbstractSeed
{
    public function run(): void
    {
        // Never re-seed a database that already has data (a second run would duplicate everything).
        if ($this->fetchRow('SELECT id FROM ingredients LIMIT 1')) {
            return;
        }

        $path = getenv('COOKBOOK_SEED') ?: dirname(__DIR__, 4) . '/src/data/cookbookSeed.json';
        $seed = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);

        foreach (CookbookData::rows($seed) as $table => $rows) {
            if ($rows !== []) {
                $this->table($table)->insert($rows)->saveData();
            }
        }
    }
}
