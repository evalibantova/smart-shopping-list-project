# Backend API (Slim + MySQL) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the PHP REST API, Phinx migration and cookbook seeder that will replace localStorage, without touching the React app yet.

**Architecture:** A Slim v4 app under `code/public/api/` (front controller `index.php`) talks to MySQL through `illuminate/database`. Tables are defined once, as a Phinx migration that is run only on dev machines (never on the host): tests apply it to in-memory SQLite, and the production schema and seed reach the FTP-only host as a `mysqldump` file pasted into phpMyAdmin. Each resource has a small repository class; routes live in `App::create()`. JSON shapes are identical to today's TypeScript types, so the frontend plans can swap services for `fetch` calls with no reshaping.

**Tech Stack:** PHP >= 8.1, Slim 4, slim/psr7, illuminate/database ^10, Phinx ^0.16 (dev only), PHPUnit 10 (phar), SQLite for tests, local MySQL 8 / MariaDB for dev and for generating the production dump.

**Spec:** `docs/superpowers/specs/2026-10-14-backend-persistence-design.md`

This is **plan 1 of 4**. Later plans (each written after the previous one lands): (2) client `api/` layer + TanStack Query + pantry end to end, (3) recipes / tags / ingredients / meal plan / import wired, then localStorage services deleted, (4) docs + deploy.

## Decisions on top of the approved spec

1. **Phinx is used** (migrations + a seeder), as in `docs/BACKEND-STACK.md`. Phinx is a composer `require-dev`; the production `vendor/` is built with `--no-dev`, so it is never uploaded.
2. **Seed via a Phinx seeder**, run locally. The production SQL is produced by `mysqldump` of the local database and pasted into phpMyAdmin (no SSH on the host).
3. **Full CRUD on every resource**, as in the spec: ingredients and tags get `PUT`/`DELETE` too (deleting one that is still referenced is a `409 conflict`). Pantry bulk deduction is `PUT /api/pantry/batch` with the body `{"deltas":[{"ingredientId":"…","delta":-2}]}`; the semantics are those of `batchUpdatePantry` (keyed by ingredient, clamped at 0, unmatched skipped), made atomic.
4. **`vendor/` lives in `code/public/api/vendor/`** so Vite copies it into `dist/` and the existing FTP upload carries it; `public/api/.htaccess` blocks it from the web. Build with `composer install --no-dev` before `npm run build`.
5. **No php-di** (confirmed by the user). Five repositories are constructed by hand in `App::create()`.

## Global Constraints

- PHP >= 8.1 (`declare(strict_types=1)` in every PHP file, matching `fetch-recipe.php`).
- Namespace `MealPlanner\Api`, PSR-4 mapped to `public/api/src/`. Do not rename or edit the existing `FetchError`, `UrlGuard`, `PageFetcher`, `RecipeExtractor` classes or `fetch-recipe.php`.
- Errors are `{"error":"<code>"}` with an HTTP status. Codes used: `invalid` (422), `not_found` (404), `bad_method` (405), `conflict` (409), `server_error` (500).
- All ids are client-suppliable UUID strings (`CHAR(36)`); the server generates one when `id` is omitted.
- Every data table has `user_id` (always `Database::USER_ID` = 1). No auth in this plan.
- `recipe_ingredients` has **no unit column**; units come from `ingredients.default_unit`.
- JSON field names exactly match `code/src/types/*.ts` (`tagIds`, `ingredientId`, `maxStock`, `createdAt` in ms, `default_unit`).
- MySQL tables are `utf8mb4` / `utf8mb4_bin` / InnoDB (exact, case- and accent-sensitive names, like the JS `===` the app relies on).
- Local dev database: host `127.0.0.1`, port 3306, database/user/password all `meal_planner`.
- Existing PHPUnit tests (`UrlGuardTest`, `PageFetcherTest`, `RecipeExtractorTest`) must keep passing.
- Do not edit anything under `design-v1/` or `design-v2/`. Do not touch `code/src` (frontend) in this plan.
- Tests run with `cd code && npm run test:php` (`php phpunit.phar`).

## File Structure

All paths relative to `code/`.

| File | Responsibility |
|---|---|
| `public/api/composer.json` | deps + PSR-4 autoload; Phinx in `require-dev` |
| `public/api/phinx.php` | Phinx config, built from `config.php` |
| `public/api/db/migrations/20261014000000_create_tables.php` | the one table definition |
| `public/api/db/seeds/CookbookSeeder.php` | Phinx seeder; inserts `CookbookData::rows()` |
| `public/api/src/Database.php` | PDO to illuminate `Connection`; `USER_ID` const |
| `public/api/src/Uuid.php` | `Uuid::v4()` |
| `public/api/src/CookbookData.php` | pure port of `src/data/cookbookImport.ts`: seed JSON to rows per table |
| `public/api/src/ApiError.php` | exception carrying error code + HTTP status |
| `public/api/src/Input.php` | request-body parsing and validation helpers |
| `public/api/src/Repository.php` | abstract base: holds the `Connection`, scoped table helper |
| `public/api/src/IngredientRepository.php`, `TagRepository.php`, `RecipeRepository.php`, `PantryRepository.php`, `MealPlanRepository.php` | one per resource |
| `public/api/src/App.php` | builds the Slim app: routes + JSON error handler |
| `public/api/index.php`, `router.php`, `config.php`, `config.local.php.example`, `.htaccess` | runtime wiring |
| `api-tests/bootstrap.php` (modify), `api-tests/TestDatabase.php`, `api-tests/ApiTestCase.php` and `*Test.php` | tests |

---

### Task 0: Tooling prerequisites (no commit)

`php` and `composer` are not installed in the current environment (`php: command not found`), and the plan needs a local MySQL.

- [ ] **Step 1: Install PHP and Composer**

Run (Debian/Ubuntu/WSL): `sudo apt-get install -y php-cli php-sqlite3 php-mysql php-mbstring php-xml php-curl unzip composer`
Verify: `php -v` prints 8.1 or newer; `php -m | grep -i -E "pdo_sqlite|pdo_mysql|mbstring"` lists all three.

- [ ] **Step 2: Local MySQL**

Either Docker:
`docker run -d --name meal-db -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=meal_planner -e MYSQL_USER=meal_planner -e MYSQL_PASSWORD=meal_planner mysql:8`
or a native server (`sudo apt-get install -y mariadb-server`, then create the `meal_planner` database and user with the same password).
Verify: `mysql -h127.0.0.1 -umeal_planner -pmeal_planner meal_planner -e "select 1"` prints `1`. Also confirm `mysqldump --version` works (needed in Task 6).

- [ ] **Step 3: Get PHPUnit 10 phar**

Run: `cd /data/code && curl -L -o phpunit.phar https://phar.phpunit.de/phpunit-10.phar`
Verify: `php phpunit.phar --version` prints `PHPUnit 10.x`. Keep the phar untracked (`git status` must not list it; if it does, add `phpunit.phar` to `code/.gitignore`).

- [ ] **Step 4: Baseline**

Run: `cd /data/code && npm run test:php`
Expected: the three existing test classes pass. If any fail, stop and report; this plan assumes a green baseline.

---

### Task 1: Composer scaffolding, Phinx migration, test database

**Files:**
- Create: `public/api/composer.json`, `public/api/phinx.php`, `public/api/config.php`, `public/api/db/migrations/20261014000000_create_tables.php`, `public/api/src/Database.php`, `public/api/src/Uuid.php`
- Modify: `api-tests/bootstrap.php`, `.gitignore`, `package.json`
- Test: `api-tests/TestDatabase.php` (helper), `api-tests/SchemaTest.php`, `api-tests/UuidTest.php`

**Interfaces:**
- Produces:
  - `Database::USER_ID` (int 1); `Database::connect(array $config): Illuminate\Database\Connection` (MySQL, config keys `host`, `port?`, `database`, `username`, `password`); `Database::fromPdo(PDO $pdo): Illuminate\Database\Connection` (SQLite or MySQL PDO).
  - `Uuid::v4(): string`.
  - Test helper `TestDatabase`: `new TestDatabase()` migrates a fresh in-memory SQLite database; `->connection(): Connection`; `->seed(): void` runs the Phinx seeders; `TestDatabase::create(): Connection` shortcut.
  - `config.php` returns `['db' => ['host','port','database','username','password']]`.

- [ ] **Step 1: Create `public/api/composer.json`**

```json
{
  "name": "meal-planner/api",
  "description": "REST API for the meal planner",
  "type": "project",
  "require": {
    "php": ">=8.1",
    "slim/slim": "^4.14",
    "slim/psr7": "^1.7",
    "illuminate/database": "^10.0"
  },
  "require-dev": {
    "robmorgan/phinx": "^0.16"
  },
  "autoload": {
    "psr-4": { "MealPlanner\\Api\\": "src/" }
  },
  "config": { "optimize-autoloader": true }
}
```

- [ ] **Step 2: Install, ignore generated files, add npm scripts**

Run: `cd /data/code && composer install --working-dir=public/api`
Append to `code/.gitignore`:

```
public/api/vendor/
public/api/config.local.php
schema.sql
.phpunit.cache/
```

Keep `public/api/composer.lock` tracked. In `code/package.json` scripts add:

```json
    "api:install": "composer install --working-dir=public/api",
    "api:migrate": "php public/api/vendor/bin/phinx migrate -c public/api/phinx.php",
    "api:seed": "php public/api/vendor/bin/phinx seed:run -c public/api/phinx.php",
    "api:reset": "php public/api/vendor/bin/phinx rollback -c public/api/phinx.php -t 0 && npm run api:migrate && npm run api:seed",
```

- [ ] **Step 3: Switch the test bootstrap to the autoloader**

Replace the whole of `api-tests/bootstrap.php` with:

```php
<?php
// code/api-tests/bootstrap.php
// Classes load through Composer's PSR-4 autoloader (MealPlanner\Api\ => public/api/src/).
declare(strict_types=1);

require __DIR__ . '/../public/api/vendor/autoload.php';
```

Run: `npm run test:php`. Expected: the three existing classes still pass (they now autoload).

- [ ] **Step 4: Write the failing tests**

`api-tests/UuidTest.php`:

```php
<?php
declare(strict_types=1);

use MealPlanner\Api\Uuid;
use PHPUnit\Framework\TestCase;

final class UuidTest extends TestCase
{
    public function testV4HasCanonicalShape(): void
    {
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/',
            Uuid::v4(),
        );
    }

    public function testV4IsUnique(): void
    {
        $this->assertNotSame(Uuid::v4(), Uuid::v4());
    }
}
```

`api-tests/TestDatabase.php` (helper; not a test class):

```php
<?php
declare(strict_types=1);

use Illuminate\Database\Connection;
use MealPlanner\Api\Database;
use Phinx\Config\Config;
use Phinx\Migration\Manager;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;

/** A fresh in-memory SQLite database built by the real Phinx migration. */
final class TestDatabase
{
    public readonly PDO $pdo;
    private Manager $manager;

    public function __construct()
    {
        $this->pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $this->pdo->exec('PRAGMA foreign_keys = ON');

        $api = dirname(__DIR__) . '/public/api';
        $config = new Config([
            'paths' => ['migrations' => "$api/db/migrations", 'seeds' => "$api/db/seeds"],
            'environments' => [
                'default_environment' => 'test',
                'test' => ['adapter' => 'sqlite', 'name' => ':memory:', 'connection' => $this->pdo],
            ],
        ]);
        $this->manager = new Manager($config, new ArrayInput([]), new BufferedOutput());
        $this->manager->migrate('test');
    }

    public function seed(): void
    {
        $this->manager->seed('test');
    }

    public function connection(): Connection
    {
        return Database::fromPdo($this->pdo);
    }

    public static function create(): Connection
    {
        return (new self())->connection();
    }
}
```

`api-tests/SchemaTest.php`:

```php
<?php
declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class SchemaTest extends TestCase
{
    public function testMigrationCreatesEveryTable(): void
    {
        $schema = TestDatabase::create()->getSchemaBuilder();

        foreach (['ingredients', 'tags', 'recipes', 'recipe_tags', 'recipe_ingredients', 'pantry_items', 'meal_plan_entries'] as $table) {
            $this->assertTrue($schema->hasTable($table), "missing table $table");
        }
    }

    public function testRecipeIngredientsHasNoUnitColumn(): void
    {
        $schema = TestDatabase::create()->getSchemaBuilder();

        $this->assertTrue($schema->hasColumn('recipe_ingredients', 'quantity'));
        $this->assertFalse($schema->hasColumn('recipe_ingredients', 'unit'));
    }

    public function testForeignKeysAreEnforced(): void
    {
        $db = TestDatabase::create();

        $this->expectException(\Illuminate\Database\QueryException::class);
        $db->table('pantry_items')->insert([
            'id' => 'p1', 'user_id' => 1, 'ingredient_id' => 'missing', 'quantity' => 1, 'max_stock' => 3,
        ]);
    }

    public function testUniqueNamePerUser(): void
    {
        $db = TestDatabase::create();
        $row = ['id' => 'a', 'user_id' => 1, 'name' => 'soľ', 'default_unit' => 'g', 'category' => 'Other'];
        $db->table('ingredients')->insert($row);

        $this->expectException(\Illuminate\Database\QueryException::class);
        $db->table('ingredients')->insert(['id' => 'b'] + $row);
    }
}
```

- [ ] **Step 5: Run to verify failure**

Run: `npm run test:php`
Expected: FAIL, `Class "MealPlanner\Api\Uuid" not found` and `Database` not found.

- [ ] **Step 6: Implement**

`public/api/src/Uuid.php`:

```php
<?php
declare(strict_types=1);

namespace MealPlanner\Api;

final class Uuid
{
    public static function v4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
```

`public/api/src/Database.php`:

```php
<?php
declare(strict_types=1);

namespace MealPlanner\Api;

use Illuminate\Database\Connection;
use Illuminate\Database\MySqlConnection;
use Illuminate\Database\SQLiteConnection;

final class Database
{
    /** Single shared dataset for now; every row carries this user_id so accounts can be added later. */
    public const USER_ID = 1;

    /** @param array{host:string,port?:int,database:string,username:string,password:string} $config */
    public static function connect(array $config): Connection
    {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['host'], $config['port'] ?? 3306, $config['database']);
        $pdo = new \PDO($dsn, $config['username'], $config['password'], [
            \PDO::ATTR_EMULATE_PREPARES => false, // native int/float types in results
            \PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8mb4 COLLATE utf8mb4_bin',
        ]);

        return self::fromPdo($pdo, $config['database']);
    }

    public static function fromPdo(\PDO $pdo, string $name = ''): Connection
    {
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

        return match ($pdo->getAttribute(\PDO::ATTR_DRIVER_NAME)) {
            'mysql' => new MySqlConnection($pdo, $name),
            'sqlite' => new SQLiteConnection($pdo, $name),
            default => throw new \InvalidArgumentException('Unsupported database driver'),
        };
    }
}
```

`public/api/config.php`:

```php
<?php
// Uses config.local.php (gitignored; copy config.local.php.example) when present.
// Otherwise the local development MySQL from the plan's prerequisites.
declare(strict_types=1);

$local = __DIR__ . '/config.local.php';

return is_file($local)
    ? require $local
    : ['db' => ['host' => '127.0.0.1', 'port' => 3306, 'database' => 'meal_planner', 'username' => 'meal_planner', 'password' => 'meal_planner']];
```

`public/api/phinx.php`:

```php
<?php
// Phinx config. Phinx only runs on dev machines; it reads the same database settings as the API.
declare(strict_types=1);

$db = (require __DIR__ . '/config.php')['db'];

return [
    'paths' => [
        'migrations' => __DIR__ . '/db/migrations',
        'seeds' => __DIR__ . '/db/seeds',
    ],
    'environments' => [
        'default_environment' => 'local',
        'local' => [
            'adapter' => 'mysql',
            'host' => $db['host'],
            'port' => $db['port'] ?? 3306,
            'name' => $db['database'],
            'user' => $db['username'],
            'pass' => $db['password'],
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_bin',
        ],
    ],
];
```

`public/api/db/migrations/20261014000000_create_tables.php`:

```php
<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateTables extends AbstractMigration
{
    private const TABLE = ['encoding' => 'utf8mb4', 'collation' => 'utf8mb4_bin', 'engine' => 'InnoDB'];

    public function change(): void
    {
        $this->table('ingredients', ['id' => false, 'primary_key' => 'id'] + self::TABLE)
            ->addColumn('id', 'char', ['limit' => 36])
            ->addColumn('user_id', 'integer', ['signed' => false, 'default' => 1])
            ->addColumn('name', 'string', ['limit' => 120])
            ->addColumn('default_unit', 'string', ['limit' => 16])
            ->addColumn('category', 'string', ['limit' => 60])
            ->addIndex(['user_id', 'name'], ['unique' => true])
            ->create();

        $this->table('tags', ['id' => false, 'primary_key' => 'id'] + self::TABLE)
            ->addColumn('id', 'char', ['limit' => 36])
            ->addColumn('user_id', 'integer', ['signed' => false, 'default' => 1])
            ->addColumn('name', 'string', ['limit' => 60])
            ->addColumn('color', 'string', ['limit' => 16])
            ->addIndex(['user_id', 'name'], ['unique' => true])
            ->create();

        $this->table('recipes', ['id' => false, 'primary_key' => 'id'] + self::TABLE)
            ->addColumn('id', 'char', ['limit' => 36])
            ->addColumn('user_id', 'integer', ['signed' => false, 'default' => 1])
            ->addColumn('emoji', 'string', ['limit' => 16])
            ->addColumn('name', 'string', ['limit' => 200])
            ->addColumn('servings', 'integer', ['signed' => false])
            ->addColumn('notes', 'text')
            ->addColumn('created_at', 'biginteger') // epoch milliseconds, like Recipe.createdAt
            ->create();

        $this->table('recipe_tags', ['id' => false, 'primary_key' => ['recipe_id', 'tag_id']] + self::TABLE)
            ->addColumn('recipe_id', 'char', ['limit' => 36])
            ->addColumn('tag_id', 'char', ['limit' => 36])
            ->addColumn('position', 'integer', ['signed' => false])
            ->addForeignKey('recipe_id', 'recipes', 'id', ['delete' => 'CASCADE'])
            ->addForeignKey('tag_id', 'tags', 'id', ['delete' => 'RESTRICT'])
            ->create();

        $this->table('recipe_ingredients', ['id' => false, 'primary_key' => ['recipe_id', 'position']] + self::TABLE)
            ->addColumn('recipe_id', 'char', ['limit' => 36])
            ->addColumn('position', 'integer', ['signed' => false])
            ->addColumn('ingredient_id', 'char', ['limit' => 36])
            ->addColumn('quantity', 'double')
            ->addForeignKey('recipe_id', 'recipes', 'id', ['delete' => 'CASCADE'])
            ->addForeignKey('ingredient_id', 'ingredients', 'id', ['delete' => 'RESTRICT'])
            ->create();

        $this->table('pantry_items', ['id' => false, 'primary_key' => 'id'] + self::TABLE)
            ->addColumn('id', 'char', ['limit' => 36])
            ->addColumn('user_id', 'integer', ['signed' => false, 'default' => 1])
            ->addColumn('ingredient_id', 'char', ['limit' => 36])
            ->addColumn('quantity', 'double')
            ->addColumn('max_stock', 'double')
            ->addForeignKey('ingredient_id', 'ingredients', 'id', ['delete' => 'RESTRICT'])
            ->create();

        $this->table('meal_plan_entries', ['id' => false, 'primary_key' => 'id'] + self::TABLE)
            ->addColumn('id', 'char', ['limit' => 36])
            ->addColumn('user_id', 'integer', ['signed' => false, 'default' => 1])
            ->addColumn('date', 'string', ['limit' => 10]) // YYYY-MM-DD
            ->addColumn('slot', 'string', ['limit' => 16])
            ->addColumn('recipe_id', 'char', ['limit' => 36])
            ->addColumn('servings', 'integer', ['signed' => false])
            ->addColumn('cooked', 'boolean', ['default' => false])
            ->addForeignKey('recipe_id', 'recipes', 'id', ['delete' => 'CASCADE'])
            ->create();
    }
}
```

- [ ] **Step 7: Run to verify pass**

Run: `npm run test:php`
Expected: PASS, including `UuidTest` and `SchemaTest`.

If `TestDatabase` fails because Phinx rejects or ignores the `connection` option for SQLite, fall back to a temp file: create `$file = tempnam(sys_get_temp_dir(), 'mp')`, use `['adapter' => 'sqlite', 'name' => $file]` (no `connection`), run the migration, then open `new PDO('sqlite:' . $file)` for `$this->pdo` (run `PRAGMA foreign_keys = ON` on it) and delete the file in a destructor. Keep the helper's public methods unchanged so no test changes.

Also verify the migration on MySQL: `npm run api:migrate` prints each table as `migrated`. Then `npm run api:reset` should roll back and re-run cleanly.

- [ ] **Step 8: Commit**

```bash
git add code/public/api/composer.json code/public/api/composer.lock code/public/api/phinx.php code/public/api/config.php code/public/api/db code/public/api/src/Database.php code/public/api/src/Uuid.php code/api-tests code/.gitignore code/package.json
git commit -m "feat(api): add Composer scaffolding, Phinx migration and test database"
```

---

### Task 2: App skeleton, error handling, ingredients and tags

**Files:**
- Create: `public/api/src/ApiError.php`, `Input.php`, `Repository.php`, `IngredientRepository.php`, `TagRepository.php`, `App.php`
- Test: `api-tests/ApiTestCase.php`, `api-tests/IngredientsApiTest.php`, `api-tests/TagsApiTest.php`

**Interfaces:**
- Consumes: `Database::USER_ID`, `Database::fromPdo`, `Uuid::v4`, `TestDatabase` (Task 1).
- Produces:
  - `ApiError::invalid(): self` (422 `invalid`), `ApiError::notFound(): self` (404 `not_found`), `->errorCode`, `->httpStatus(): int`.
  - `Input::body(ServerRequestInterface): array`, `Input::str(array,string,int $max): string`, `Input::text(array,string): string` (may be empty), `Input::integer(array,string,int $min): int`, `Input::number(array,string): float` (>= 0), `Input::boolean(array,string): bool`, `Input::oneOf(array,string,array): string`, `Input::date(array,string): string`, `Input::id(array,string): string` (required UUID), `Input::newId(array): string` (optional `id`, else generated).
  - `abstract class Repository { __construct(protected Connection $db); protected function owned(string $table): Illuminate\Database\Query\Builder }` (adds `where user_id`).
  - `IngredientRepository::all(): array`, `->create(array $body): array`, `->update(string $id, array $body): array` (partial), `->delete(string $id): void` (404 if missing, 409 if still referenced), const `UNITS`; `TagRepository` with the same four methods.
  - `App::create(Connection $db): Slim\App`.
  - Test helper `ApiTestCase::$testDb` (a `TestDatabase`; `->seed()` loads the cookbook) and `ApiTestCase::call(string $method, string $path, ?array $body = null): array{0:int,1:mixed}`, `ApiTestCase::makeIngredient(string $name = 'mäso', string $unit = 'g'): string` (returns id), `ApiTestCase::makeTag(string $name = 'Polievka'): string`.

- [ ] **Step 1: Write the test base class**

`api-tests/ApiTestCase.php`:

```php
<?php
declare(strict_types=1);

use Illuminate\Database\Connection;
use MealPlanner\Api\App;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Factory\StreamFactory;

abstract class ApiTestCase extends TestCase
{
    protected TestDatabase $testDb;
    protected Connection $db;
    protected \Slim\App $app;

    protected function setUp(): void
    {
        $this->testDb = new TestDatabase();
        $this->db = $this->testDb->connection();
        $this->app = App::create($this->db);
    }

    /** @return array{0:int,1:mixed} [status, decoded JSON body or null] */
    protected function call(string $method, string $path, ?array $body = null): array
    {
        $request = (new ServerRequestFactory())->createServerRequest($method, 'http://localhost' . $path);
        if ($body !== null) {
            $request = $request
                ->withHeader('Content-Type', 'application/json')
                ->withBody((new StreamFactory())->createStream(json_encode($body, JSON_THROW_ON_ERROR)));
        }
        $response = $this->app->handle($request);
        $raw = (string) $response->getBody();

        return [$response->getStatusCode(), $raw === '' ? null : json_decode($raw, true)];
    }

    protected function makeIngredient(string $name = 'mäso', string $unit = 'g'): string
    {
        [$status, $row] = $this->call('POST', '/api/ingredients', [
            'name' => $name, 'default_unit' => $unit, 'category' => 'Meat',
        ]);
        $this->assertSame(201, $status);

        return $row['id'];
    }

    protected function makeTag(string $name = 'Polievka'): string
    {
        [$status, $row] = $this->call('POST', '/api/tags', ['name' => $name, 'color' => '#26A69A']);
        $this->assertSame(201, $status);

        return $row['id'];
    }
}
```

- [ ] **Step 2: Write the failing tests**

`api-tests/IngredientsApiTest.php`:

```php
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
```

`api-tests/TagsApiTest.php`:

```php
<?php
declare(strict_types=1);

final class TagsApiTest extends ApiTestCase
{
    public function testCreateAndList(): void
    {
        [$status, $tag] = $this->call('POST', '/api/tags', ['name' => 'Dezert', 'color' => '#F06292']);

        $this->assertSame(201, $status);
        $this->assertSame(['id' => $tag['id'], 'name' => 'Dezert', 'color' => '#F06292'], $tag);
        $this->assertSame([200, [$tag]], $this->call('GET', '/api/tags'));
    }

    public function testRejectsMissingColor(): void
    {
        $this->assertSame([422, ['error' => 'invalid']], $this->call('POST', '/api/tags', ['name' => 'x']));
    }

    public function testDuplicateNameIsAConflict(): void
    {
        $this->makeTag('Snack');

        $this->assertSame([409, ['error' => 'conflict']], $this->call('POST', '/api/tags', ['name' => 'Snack', 'color' => '#fff']));
    }

    public function testUpdateIsPartial(): void
    {
        $id = $this->makeTag('Dezert');

        [$status, $tag] = $this->call('PUT', "/api/tags/$id", ['color' => '#000000']);

        $this->assertSame(200, $status);
        $this->assertSame(['id' => $id, 'name' => 'Dezert', 'color' => '#000000'], $tag);
        $this->assertSame([404, ['error' => 'not_found']], $this->call('PUT', '/api/tags/11111111-2222-4333-8444-555555555555', ['name' => 'x']));
    }

    public function testDeleteRemovesAnUnusedTag(): void
    {
        $id = $this->makeTag('Snack');

        $this->assertSame([204, null], $this->call('DELETE', "/api/tags/$id"));
        $this->assertSame([200, []], $this->call('GET', '/api/tags'));
        $this->assertSame([404, ['error' => 'not_found']], $this->call('DELETE', "/api/tags/$id"));
    }
}
```

- [ ] **Step 3: Run to verify failure**

Run: `npm run test:php`
Expected: FAIL, `Class "MealPlanner\Api\App" not found`.

- [ ] **Step 4: Implement the support classes**

`public/api/src/ApiError.php`:

```php
<?php
declare(strict_types=1);

namespace MealPlanner\Api;

final class ApiError extends \RuntimeException
{
    public function __construct(public readonly string $errorCode, private readonly int $status)
    {
        parent::__construct($errorCode);
    }

    public function httpStatus(): int
    {
        return $this->status;
    }

    public static function invalid(): self
    {
        return new self('invalid', 422);
    }

    public static function notFound(): self
    {
        return new self('not_found', 404);
    }
}
```

`public/api/src/Input.php`:

```php
<?php
declare(strict_types=1);

namespace MealPlanner\Api;

use Psr\Http\Message\ServerRequestInterface;

/** Request-body parsing. Every failure is an ApiError::invalid() (422). */
final class Input
{
    private const UUID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';

    /** @return array<string, mixed> */
    public static function body(ServerRequestInterface $request): array
    {
        $data = json_decode((string) $request->getBody(), true);
        if (!is_array($data) || array_is_list($data)) {
            throw ApiError::invalid();
        }

        return $data;
    }

    /** Non-empty string of at most $max characters. */
    public static function str(array $data, string $key, int $max): string
    {
        $value = $data[$key] ?? null;
        if (!is_string($value) || $value === '' || mb_strlen($value) > $max) {
            throw ApiError::invalid();
        }

        return $value;
    }

    /** String that may be empty (e.g. recipe notes). */
    public static function text(array $data, string $key): string
    {
        $value = $data[$key] ?? null;
        if (!is_string($value)) {
            throw ApiError::invalid();
        }

        return $value;
    }

    public static function integer(array $data, string $key, int $min): int
    {
        $value = $data[$key] ?? null;
        if (!is_int($value) || $value < $min) {
            throw ApiError::invalid();
        }

        return $value;
    }

    /** Number >= 0. */
    public static function number(array $data, string $key): float
    {
        $value = $data[$key] ?? null;
        if ((!is_int($value) && !is_float($value)) || $value < 0) {
            throw ApiError::invalid();
        }

        return (float) $value;
    }

    public static function boolean(array $data, string $key): bool
    {
        $value = $data[$key] ?? null;
        if (!is_bool($value)) {
            throw ApiError::invalid();
        }

        return $value;
    }

    /** @param list<string> $allowed */
    public static function oneOf(array $data, string $key, array $allowed): string
    {
        $value = $data[$key] ?? null;
        if (!is_string($value) || !in_array($value, $allowed, true)) {
            throw ApiError::invalid();
        }

        return $value;
    }

    /** A real calendar date as YYYY-MM-DD. */
    public static function date(array $data, string $key): string
    {
        $value = $data[$key] ?? null;
        if (!is_string($value) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m) || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            throw ApiError::invalid();
        }

        return $value;
    }

    /** Required UUID string. */
    public static function id(array $data, string $key): string
    {
        $value = $data[$key] ?? null;
        if (!is_string($value) || !preg_match(self::UUID, $value)) {
            throw ApiError::invalid();
        }

        return $value;
    }

    /** Optional client-supplied `id` (so optimistic updates keep stable ids); generated when absent. */
    public static function newId(array $data): string
    {
        return array_key_exists('id', $data) ? self::id($data, 'id') : Uuid::v4();
    }
}
```

`public/api/src/Repository.php`:

```php
<?php
declare(strict_types=1);

namespace MealPlanner\Api;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;

abstract class Repository
{
    public function __construct(protected Connection $db)
    {
    }

    /** Query builder for a user-scoped table, already filtered to the current user. */
    protected function owned(string $table): Builder
    {
        return $this->db->table($table)->where($table . '.user_id', Database::USER_ID);
    }
}
```

`public/api/src/IngredientRepository.php`:

```php
<?php
declare(strict_types=1);

namespace MealPlanner\Api;

final class IngredientRepository extends Repository
{
    public const UNITS = ['g', 'ml', 'kg', 'l', 'pcs', 'cloves', 'tbsp', 'tsp'];

    /** @return list<array{id:string,name:string,default_unit:string,category:string}> */
    public function all(): array
    {
        return array_map(self::present(...), $this->owned('ingredients')->orderBy('name')->get()->all());
    }

    /** @param array<string, mixed> $body */
    public function create(array $body): array
    {
        $row = [
            'id' => Input::newId($body),
            'user_id' => Database::USER_ID,
            'name' => Input::str($body, 'name', 120),
            'default_unit' => Input::oneOf($body, 'default_unit', self::UNITS),
            'category' => Input::str($body, 'category', 60),
        ];
        $this->db->table('ingredients')->insert($row);

        return self::present((object) $row);
    }

    /** @param array<string, mixed> $body */
    public function update(string $id, array $body): array
    {
        $this->find($id);
        $columns = [];
        if (array_key_exists('name', $body)) {
            $columns['name'] = Input::str($body, 'name', 120);
        }
        if (array_key_exists('default_unit', $body)) {
            $columns['default_unit'] = Input::oneOf($body, 'default_unit', self::UNITS);
        }
        if (array_key_exists('category', $body)) {
            $columns['category'] = Input::str($body, 'category', 60);
        }
        if ($columns !== []) {
            $this->owned('ingredients')->where('id', $id)->update($columns);
        }

        return self::present($this->find($id));
    }

    /** Fails with a 409 (foreign key) while a recipe or pantry item still uses the ingredient. */
    public function delete(string $id): void
    {
        $this->find($id);
        $this->owned('ingredients')->where('id', $id)->delete();
    }

    private function find(string $id): object
    {
        $row = $this->owned('ingredients')->where('id', $id)->first();
        if ($row === null) {
            throw ApiError::notFound();
        }

        return $row;
    }

    private static function present(object $row): array
    {
        return ['id' => $row->id, 'name' => $row->name, 'default_unit' => $row->default_unit, 'category' => $row->category];
    }
}
```

`public/api/src/TagRepository.php`:

```php
<?php
declare(strict_types=1);

namespace MealPlanner\Api;

final class TagRepository extends Repository
{
    /** @return list<array{id:string,name:string,color:string}> */
    public function all(): array
    {
        return array_map(self::present(...), $this->owned('tags')->orderBy('name')->get()->all());
    }

    /** @param array<string, mixed> $body */
    public function create(array $body): array
    {
        $row = [
            'id' => Input::newId($body),
            'user_id' => Database::USER_ID,
            'name' => Input::str($body, 'name', 60),
            'color' => Input::str($body, 'color', 16),
        ];
        $this->db->table('tags')->insert($row);

        return self::present((object) $row);
    }

    /** @param array<string, mixed> $body */
    public function update(string $id, array $body): array
    {
        $this->find($id);
        $columns = [];
        if (array_key_exists('name', $body)) {
            $columns['name'] = Input::str($body, 'name', 60);
        }
        if (array_key_exists('color', $body)) {
            $columns['color'] = Input::str($body, 'color', 16);
        }
        if ($columns !== []) {
            $this->owned('tags')->where('id', $id)->update($columns);
        }

        return self::present($this->find($id));
    }

    /** Fails with a 409 (foreign key) while a recipe still uses the tag. */
    public function delete(string $id): void
    {
        $this->find($id);
        $this->owned('tags')->where('id', $id)->delete();
    }

    private function find(string $id): object
    {
        $row = $this->owned('tags')->where('id', $id)->first();
        if ($row === null) {
            throw ApiError::notFound();
        }

        return $row;
    }

    private static function present(object $row): array
    {
        return ['id' => $row->id, 'name' => $row->name, 'color' => $row->color];
    }
}
```

- [ ] **Step 5: Implement `App`**

`public/api/src/App.php` (recipes, pantry and meal-plan routes are added in Tasks 3 to 5; leave the marked comment lines in place):

```php
<?php
declare(strict_types=1);

namespace MealPlanner\Api;

use Illuminate\Database\Connection;
use Illuminate\Database\QueryException;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App as SlimApp;
use Slim\Exception\HttpMethodNotAllowedException;
use Slim\Exception\HttpNotFoundException;
use Slim\Factory\AppFactory;

final class App
{
    public static function create(Connection $db): SlimApp
    {
        $ingredients = new IngredientRepository($db);
        $tags = new TagRepository($db);

        $json = static function (Response $response, mixed $data, int $status = 200): Response {
            $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));

            return $response
                ->withStatus($status)
                ->withHeader('Content-Type', 'application/json; charset=utf-8')
                ->withHeader('Cache-Control', 'no-store');
        };

        $app = AppFactory::create();
        $app->setBasePath('/api');
        $app->addRoutingMiddleware();

        $app->get('/ingredients', fn (Request $q, Response $r) => $json($r, $ingredients->all()));
        $app->post('/ingredients', fn (Request $q, Response $r) => $json($r, $ingredients->create(Input::body($q)), 201));
        $app->put('/ingredients/{id}', fn (Request $q, Response $r, array $args) => $json($r, $ingredients->update($args['id'], Input::body($q))));
        $app->delete('/ingredients/{id}', function (Request $q, Response $r, array $args) use ($ingredients) {
            $ingredients->delete($args['id']);

            return $r->withStatus(204);
        });

        $app->get('/tags', fn (Request $q, Response $r) => $json($r, $tags->all()));
        $app->post('/tags', fn (Request $q, Response $r) => $json($r, $tags->create(Input::body($q)), 201));
        $app->put('/tags/{id}', fn (Request $q, Response $r, array $args) => $json($r, $tags->update($args['id'], Input::body($q))));
        $app->delete('/tags/{id}', function (Request $q, Response $r, array $args) use ($tags) {
            $tags->delete($args['id']);

            return $r->withStatus(204);
        });

        // ROUTES:recipes
        // ROUTES:pantry
        // ROUTES:meal-plan

        $errors = $app->addErrorMiddleware(false, false, false);
        $errors->setDefaultErrorHandler(static function (Request $request, \Throwable $e) use ($app, $json): Response {
            [$status, $code] = match (true) {
                $e instanceof ApiError => [$e->httpStatus(), $e->errorCode],
                $e instanceof HttpNotFoundException => [404, 'not_found'],
                $e instanceof HttpMethodNotAllowedException => [405, 'bad_method'],
                // 23000 = integrity constraint (duplicate key, unknown foreign key)
                $e instanceof QueryException && (string) $e->getCode() === '23000' => [409, 'conflict'],
                default => [500, 'server_error'],
            };
            if ($status === 500) {
                error_log((string) $e);
            }

            return $json($app->getResponseFactory()->createResponse(), ['error' => $code], $status);
        });

        return $app;
    }
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npm run test:php`
Expected: PASS. If `testWrongMethodIs405Json` returns 404, Slim version differences are the cause: confirm `HttpMethodNotAllowedException` is thrown by routing (it is in Slim 4) and that `addRoutingMiddleware()` precedes `addErrorMiddleware()`.

- [ ] **Step 7: Commit**

```bash
git add code/public/api/src code/api-tests
git commit -m "feat(api): add Slim app with ingredients and tags endpoints"
```

---

### Task 3: Recipes

**Files:**
- Create: `public/api/src/RecipeRepository.php`
- Modify: `public/api/src/App.php` (replace the `// ROUTES:recipes` line)
- Test: `api-tests/RecipesApiTest.php`

**Interfaces:**
- Consumes: everything from Task 2.
- Produces: `RecipeRepository::all(): array`, `->find(string $id): array` (throws `ApiError::notFound()`), `->create(array $body): array`, `->update(string $id, array $body): array`, `->delete(string $id): void`. A recipe is `{id, emoji, name, servings, tagIds: string[], ingredients: [{ingredientId, quantity}], notes, createdAt}`.

- [ ] **Step 1: Write the failing tests**

`api-tests/RecipesApiTest.php`:

```php
<?php
declare(strict_types=1);

final class RecipesApiTest extends ApiTestCase
{
    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'emoji' => '🍲',
            'name' => 'Kapustnica',
            'servings' => 4,
            'tagIds' => [$this->makeTag('Polievka')],
            'ingredients' => [['ingredientId' => $this->makeIngredient('kapusta'), 'quantity' => 500]],
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
}
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:php`
Expected: FAIL, 404 `not_found` where 201 is expected (route missing).

- [ ] **Step 3: Implement `RecipeRepository`**

`public/api/src/RecipeRepository.php`:

```php
<?php
declare(strict_types=1);

namespace MealPlanner\Api;

final class RecipeRepository extends Repository
{
    /** @return list<array<string, mixed>> */
    public function all(): array
    {
        return $this->hydrate($this->owned('recipes')->orderBy('created_at')->orderBy('id')->get()->all());
    }

    /** @return array<string, mixed> */
    public function find(string $id): array
    {
        $row = $this->owned('recipes')->where('id', $id)->first();
        if ($row === null) {
            throw ApiError::notFound();
        }

        return $this->hydrate([$row])[0];
    }

    /** @param array<string, mixed> $body */
    public function create(array $body): array
    {
        $id = Input::newId($body);
        $fields = $this->parse($body, partial: false);

        $this->db->transaction(function () use ($id, $fields) {
            $this->db->table('recipes')->insert([
                'id' => $id,
                'user_id' => Database::USER_ID,
                'emoji' => $fields['emoji'],
                'name' => $fields['name'],
                'servings' => $fields['servings'],
                'notes' => $fields['notes'],
                'created_at' => (int) round(microtime(true) * 1000),
            ]);
            $this->replaceLinks($id, $fields['tagIds'], $fields['ingredients']);
        });

        return $this->find($id);
    }

    /** @param array<string, mixed> $body */
    public function update(string $id, array $body): array
    {
        $this->find($id); // 404 when missing
        $fields = $this->parse($body, partial: true);

        $this->db->transaction(function () use ($id, $fields) {
            $columns = array_intersect_key($fields, array_flip(['emoji', 'name', 'servings', 'notes']));
            if ($columns !== []) {
                $this->owned('recipes')->where('id', $id)->update($columns);
            }
            if (array_key_exists('tagIds', $fields)) {
                $this->db->table('recipe_tags')->where('recipe_id', $id)->delete();
                $this->insertTags($id, $fields['tagIds']);
            }
            if (array_key_exists('ingredients', $fields)) {
                $this->db->table('recipe_ingredients')->where('recipe_id', $id)->delete();
                $this->insertIngredients($id, $fields['ingredients']);
            }
        });

        return $this->find($id);
    }

    public function delete(string $id): void
    {
        $this->find($id); // 404 when missing
        $this->owned('recipes')->where('id', $id)->delete(); // join rows go via ON DELETE CASCADE
    }

    /**
     * Validates the body. Full mode requires emoji, name and servings and defaults the rest;
     * partial mode validates only the keys present.
     *
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    private function parse(array $body, bool $partial): array
    {
        $rules = [
            'emoji' => fn () => Input::str($body, 'emoji', 16),
            'name' => fn () => Input::str($body, 'name', 200),
            'servings' => fn () => Input::integer($body, 'servings', 1),
            'notes' => fn () => Input::text($body, 'notes'),
            'tagIds' => fn () => self::tagIds($body['tagIds'] ?? null),
            'ingredients' => fn () => self::ingredientLines($body['ingredients'] ?? null),
        ];
        $defaults = ['notes' => '', 'tagIds' => [], 'ingredients' => []];

        $out = [];
        foreach ($rules as $key => $rule) {
            if (array_key_exists($key, $body)) {
                $out[$key] = $rule();
            } elseif (!$partial) {
                if (!array_key_exists($key, $defaults)) {
                    throw ApiError::invalid();
                }
                $out[$key] = $defaults[$key];
            }
        }

        return $out;
    }

    /** @return list<string> */
    private static function tagIds(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value)) {
            throw ApiError::invalid();
        }

        return array_map(fn ($id) => Input::id(['id' => $id], 'id'), $value);
    }

    /** @return list<array{ingredientId:string,quantity:float}> */
    private static function ingredientLines(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value)) {
            throw ApiError::invalid();
        }

        return array_map(function ($line) {
            if (!is_array($line)) {
                throw ApiError::invalid();
            }

            return ['ingredientId' => Input::id($line, 'ingredientId'), 'quantity' => Input::number($line, 'quantity')];
        }, $value);
    }

    private function replaceLinks(string $id, array $tagIds, array $ingredients): void
    {
        $this->insertTags($id, $tagIds);
        $this->insertIngredients($id, $ingredients);
    }

    private function insertTags(string $id, array $tagIds): void
    {
        foreach (array_values($tagIds) as $position => $tagId) {
            $this->db->table('recipe_tags')->insert(['recipe_id' => $id, 'tag_id' => $tagId, 'position' => $position]);
        }
    }

    private function insertIngredients(string $id, array $ingredients): void
    {
        foreach (array_values($ingredients) as $position => $line) {
            $this->db->table('recipe_ingredients')->insert([
                'recipe_id' => $id,
                'position' => $position,
                'ingredient_id' => $line['ingredientId'],
                'quantity' => $line['quantity'],
            ]);
        }
    }

    /**
     * @param list<object> $rows
     * @return list<array<string, mixed>>
     */
    private function hydrate(array $rows): array
    {
        $ids = array_map(fn ($r) => $r->id, $rows);

        $tags = [];
        foreach ($this->db->table('recipe_tags')->whereIn('recipe_id', $ids)->orderBy('position')->get() as $row) {
            $tags[$row->recipe_id][] = $row->tag_id;
        }
        $lines = [];
        foreach ($this->db->table('recipe_ingredients')->whereIn('recipe_id', $ids)->orderBy('position')->get() as $row) {
            $lines[$row->recipe_id][] = ['ingredientId' => $row->ingredient_id, 'quantity' => (float) $row->quantity];
        }

        return array_map(fn ($r) => [
            'id' => $r->id,
            'emoji' => $r->emoji,
            'name' => $r->name,
            'servings' => (int) $r->servings,
            'tagIds' => $tags[$r->id] ?? [],
            'ingredients' => $lines[$r->id] ?? [],
            'notes' => $r->notes,
            'createdAt' => (int) $r->created_at,
        ], $rows);
    }
}
```

- [ ] **Step 4: Register the routes**

In `App.php`, add `$recipes = new RecipeRepository($db);` next to the other repositories and replace the `// ROUTES:recipes` line with:

```php
        $app->get('/recipes', fn (Request $q, Response $r) => $json($r, $recipes->all()));
        $app->post('/recipes', fn (Request $q, Response $r) => $json($r, $recipes->create(Input::body($q)), 201));
        $app->put('/recipes/{id}', fn (Request $q, Response $r, array $args) => $json($r, $recipes->update($args['id'], Input::body($q))));
        $app->delete('/recipes/{id}', function (Request $q, Response $r, array $args) use ($recipes) {
            $recipes->delete($args['id']);

            return $r->withStatus(204);
        });
```

- [ ] **Step 5: Run to verify pass**

Run: `npm run test:php`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add code/public/api/src code/api-tests/RecipesApiTest.php
git commit -m "feat(api): add recipes endpoints"
```

---

### Task 4: Pantry

**Files:**
- Create: `public/api/src/PantryRepository.php`
- Modify: `public/api/src/App.php` (replace the `// ROUTES:pantry` line)
- Test: `api-tests/PantryApiTest.php`

**Interfaces:**
- Consumes: Task 2 (`Input`, `Repository`, `ApiTestCase::makeIngredient`).
- Produces: `PantryRepository::all()`, `->create(array)`, `->update(string $id, array)`, `->delete(string $id)`, `->adjust(array $body): array` (returns the changed items). A pantry item is `{id, ingredientId, quantity, maxStock}`. `PUT /api/pantry/batch` body `{"deltas":[{"ingredientId":"…","delta":-2}]}`; deltas for ingredients with no pantry item are skipped; quantities are clamped at 0; all changes happen in one transaction.

- [ ] **Step 1: Write the failing tests**

`api-tests/PantryApiTest.php`:

```php
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:php`
Expected: FAIL (404 for `/api/pantry`).

- [ ] **Step 3: Implement `PantryRepository`**

`public/api/src/PantryRepository.php`:

```php
<?php
declare(strict_types=1);

namespace MealPlanner\Api;

final class PantryRepository extends Repository
{
    /** @return list<array{id:string,ingredientId:string,quantity:float,maxStock:float}> */
    public function all(): array
    {
        return array_map(self::present(...), $this->owned('pantry_items')->orderBy('id')->get()->all());
    }

    /** @param array<string, mixed> $body */
    public function create(array $body): array
    {
        $quantity = Input::number($body, 'quantity');
        $row = [
            'id' => Input::newId($body),
            'user_id' => Database::USER_ID,
            'ingredient_id' => Input::id($body, 'ingredientId'),
            'quantity' => $quantity,
            'max_stock' => array_key_exists('maxStock', $body) ? Input::number($body, 'maxStock') : max(1.0, $quantity * 3),
        ];
        $this->db->table('pantry_items')->insert($row);

        return self::present((object) $row);
    }

    /** @param array<string, mixed> $body */
    public function update(string $id, array $body): array
    {
        $this->find($id);
        $columns = [];
        if (array_key_exists('ingredientId', $body)) {
            $columns['ingredient_id'] = Input::id($body, 'ingredientId');
        }
        if (array_key_exists('quantity', $body)) {
            $columns['quantity'] = Input::number($body, 'quantity');
        }
        if (array_key_exists('maxStock', $body)) {
            $columns['max_stock'] = Input::number($body, 'maxStock');
        }
        if ($columns !== []) {
            $this->owned('pantry_items')->where('id', $id)->update($columns);
        }

        return self::present($this->find($id));
    }

    public function delete(string $id): void
    {
        $this->find($id);
        $this->owned('pantry_items')->where('id', $id)->delete();
    }

    /**
     * Applies quantity deltas keyed by ingredient, clamped at 0, in one transaction.
     * Deltas for ingredients without a pantry item are skipped (same as the old client-side batch).
     *
     * @param array<string, mixed> $body {"deltas":[{"ingredientId":string,"delta":number}]}
     * @return list<array<string, mixed>> the items that changed
     */
    public function adjust(array $body): array
    {
        $deltas = $body['deltas'] ?? null;
        if (!is_array($deltas) || !array_is_list($deltas)) {
            throw ApiError::invalid();
        }
        $parsed = array_map(function ($line) {
            if (!is_array($line) || !is_int($line['delta'] ?? null) && !is_float($line['delta'] ?? null)) {
                throw ApiError::invalid();
            }

            return ['ingredientId' => Input::id($line, 'ingredientId'), 'delta' => (float) $line['delta']];
        }, $deltas); // validate everything before touching the database

        return $this->db->transaction(function () use ($parsed) {
            $changed = [];
            foreach ($parsed as ['ingredientId' => $ingredientId, 'delta' => $delta]) {
                $item = $this->owned('pantry_items')->where('ingredient_id', $ingredientId)->orderBy('id')->first();
                if ($item === null) {
                    continue;
                }
                $item->quantity = max(0.0, (float) $item->quantity + $delta);
                $this->owned('pantry_items')->where('id', $item->id)->update(['quantity' => $item->quantity]);
                $changed[$item->id] = self::present($item); // later deltas for the same item overwrite earlier ones
            }

            return array_values($changed);
        });
    }

    private function find(string $id): object
    {
        $row = $this->owned('pantry_items')->where('id', $id)->first();
        if ($row === null) {
            throw ApiError::notFound();
        }

        return $row;
    }

    private static function present(object $row): array
    {
        return [
            'id' => $row->id,
            'ingredientId' => $row->ingredient_id,
            'quantity' => (float) $row->quantity,
            'maxStock' => (float) $row->max_stock,
        ];
    }
}
```

- [ ] **Step 4: Register the routes**

In `App.php` add `$pantry = new PantryRepository($db);` and replace `// ROUTES:pantry` with:

```php
        $app->get('/pantry', fn (Request $q, Response $r) => $json($r, $pantry->all()));
        $app->post('/pantry', fn (Request $q, Response $r) => $json($r, $pantry->create(Input::body($q)), 201));
        $app->put('/pantry/batch', fn (Request $q, Response $r) => $json($r, $pantry->adjust(Input::body($q))));
        $app->put('/pantry/{id}', fn (Request $q, Response $r, array $args) => $json($r, $pantry->update($args['id'], Input::body($q))));
        $app->delete('/pantry/{id}', function (Request $q, Response $r, array $args) use ($pantry) {
            $pantry->delete($args['id']);

            return $r->withStatus(204);
        });
```

- [ ] **Step 5: Run to verify pass**

Run: `npm run test:php`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add code/public/api/src code/api-tests/PantryApiTest.php
git commit -m "feat(api): add pantry endpoints with atomic adjust"
```

---

### Task 5: Meal plan

**Files:**
- Create: `public/api/src/MealPlanRepository.php`
- Modify: `public/api/src/App.php` (replace the `// ROUTES:meal-plan` line)
- Test: `api-tests/MealPlanApiTest.php`

**Interfaces:**
- Consumes: Task 2 helpers; recipes via `POST /api/recipes` in tests.
- Produces: `MealPlanRepository::all()`, `->create(array)`, `->update(string $id, array)`, `->delete(string $id)`. An entry is `{id, date: "YYYY-MM-DD", slot: breakfast|lunch|dinner, recipeId, servings, cooked: bool}`.

- [ ] **Step 1: Write the failing tests**

`api-tests/MealPlanApiTest.php`:

```php
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
}
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:php`
Expected: FAIL (404 for `/api/meal-plan`).

- [ ] **Step 3: Implement `MealPlanRepository`**

`public/api/src/MealPlanRepository.php`:

```php
<?php
declare(strict_types=1);

namespace MealPlanner\Api;

final class MealPlanRepository extends Repository
{
    public const SLOTS = ['breakfast', 'lunch', 'dinner'];

    /** @return list<array<string, mixed>> */
    public function all(): array
    {
        return array_map(self::present(...), $this->owned('meal_plan_entries')->orderBy('date')->orderBy('id')->get()->all());
    }

    /** @param array<string, mixed> $body */
    public function create(array $body): array
    {
        $row = [
            'id' => Input::newId($body),
            'user_id' => Database::USER_ID,
            'date' => Input::date($body, 'date'),
            'slot' => Input::oneOf($body, 'slot', self::SLOTS),
            'recipe_id' => Input::id($body, 'recipeId'),
            'servings' => Input::integer($body, 'servings', 1),
            'cooked' => array_key_exists('cooked', $body) ? Input::boolean($body, 'cooked') : false,
        ];
        $this->db->table('meal_plan_entries')->insert($row);

        return self::present((object) $row);
    }

    /** @param array<string, mixed> $body */
    public function update(string $id, array $body): array
    {
        $this->find($id);
        $columns = [];
        if (array_key_exists('date', $body)) {
            $columns['date'] = Input::date($body, 'date');
        }
        if (array_key_exists('slot', $body)) {
            $columns['slot'] = Input::oneOf($body, 'slot', self::SLOTS);
        }
        if (array_key_exists('recipeId', $body)) {
            $columns['recipe_id'] = Input::id($body, 'recipeId');
        }
        if (array_key_exists('servings', $body)) {
            $columns['servings'] = Input::integer($body, 'servings', 1);
        }
        if (array_key_exists('cooked', $body)) {
            $columns['cooked'] = Input::boolean($body, 'cooked');
        }
        if ($columns !== []) {
            $this->owned('meal_plan_entries')->where('id', $id)->update($columns);
        }

        return self::present($this->find($id));
    }

    public function delete(string $id): void
    {
        $this->find($id);
        $this->owned('meal_plan_entries')->where('id', $id)->delete();
    }

    private function find(string $id): object
    {
        $row = $this->owned('meal_plan_entries')->where('id', $id)->first();
        if ($row === null) {
            throw ApiError::notFound();
        }

        return $row;
    }

    private static function present(object $row): array
    {
        return [
            'id' => $row->id,
            'date' => $row->date,
            'slot' => $row->slot,
            'recipeId' => $row->recipe_id,
            'servings' => (int) $row->servings,
            'cooked' => (bool) $row->cooked,
        ];
    }
}
```

- [ ] **Step 4: Register the routes**

In `App.php` add `$mealPlan = new MealPlanRepository($db);` and replace `// ROUTES:meal-plan` with:

```php
        $app->get('/meal-plan', fn (Request $q, Response $r) => $json($r, $mealPlan->all()));
        $app->post('/meal-plan', fn (Request $q, Response $r) => $json($r, $mealPlan->create(Input::body($q)), 201));
        $app->put('/meal-plan/{id}', fn (Request $q, Response $r, array $args) => $json($r, $mealPlan->update($args['id'], Input::body($q))));
        $app->delete('/meal-plan/{id}', function (Request $q, Response $r, array $args) use ($mealPlan) {
            $mealPlan->delete($args['id']);

            return $r->withStatus(204);
        });
```

- [ ] **Step 5: Run to verify pass**

Run: `npm run test:php`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add code/public/api/src code/api-tests/MealPlanApiTest.php
git commit -m "feat(api): add meal plan endpoints"
```

---

### Task 6: Cookbook seeder and production dump

**Files:**
- Create: `public/api/src/CookbookData.php`, `public/api/db/seeds/CookbookSeeder.php`
- Modify: `package.json` (add `api:sql`)
- Test: `api-tests/CookbookDataTest.php`, `api-tests/CookbookSeedTest.php`

**Interfaces:**
- Consumes: `Database::USER_ID`, `Uuid::v4` (Task 1), `TestDatabase` and `ApiTestCase` (Tasks 1, 2).
- Produces: `CookbookData::rows(array $seed, ?int $now = null): array` returning rows keyed by table (`ingredients`, `tags`, `recipes`, `recipe_tags`, `recipe_ingredients`) in foreign-key-safe order; the Phinx seeder `CookbookSeeder`; `npm run api:sql` writing `schema.sql`.

`src/data/cookbookSeed.json` stays the single source of truth (163 ingredients, 53 recipes). The name-to-id mapping, tag colours and emoji rules are a port of `src/data/cookbookImport.ts`. `CookbookData` is pure (no database) so it is trivially testable; the Phinx seeder only inserts what it returns.

- [ ] **Step 1: Write the failing tests**

`api-tests/CookbookDataTest.php`:

```php
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
        $this->assertSame(count($rows['recipes']), count(array_unique(array_column($rows['recipe_tags'], 'recipe_id'))), 'every recipe has at least its category tag');
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
```

`api-tests/CookbookSeedTest.php`:

```php
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:php`
Expected: FAIL, `Class "MealPlanner\Api\CookbookData" not found`.

- [ ] **Step 3: Implement `CookbookData`**

`public/api/src/CookbookData.php`:

```php
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
```

- [ ] **Step 4: Implement the Phinx seeder**

`public/api/db/seeds/CookbookSeeder.php`:

```php
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
```

- [ ] **Step 5: Add the dump script**

In `code/package.json` scripts add (single line; `--no-tablespaces` keeps it working for unprivileged users, and the Phinx bookkeeping table is excluded because Phinx is never run on the host):

```json
    "api:sql": "mysqldump -h127.0.0.1 -umeal_planner -pmeal_planner --no-tablespaces --skip-comments --ignore-table=meal_planner.phinxlog meal_planner > schema.sql",
```

- [ ] **Step 6: Run to verify pass**

Run: `npm run test:php`
Expected: PASS. If `testSeederLeavesAnExistingDatabaseAlone` or the counts fail because `getenv('COOKBOOK_SEED')` is set in your shell, unset it.

- [ ] **Step 7: Verify on real MySQL and produce the production SQL**

```bash
cd /data/code
npm run api:reset                                   # rollback, migrate, seed on the local MySQL
mysql -h127.0.0.1 -umeal_planner -pmeal_planner meal_planner -e "select count(*) from ingredients; select count(*) from recipes;"
npm run api:sql && head -n 30 schema.sql && grep -c "^INSERT" schema.sql
```

Expected: 163 and 53; `schema.sql` holds `CREATE TABLE` for 7 tables (`ENGINE=InnoDB ... utf8mb4_bin`) and `INSERT` statements. `schema.sql` is git-ignored. Re-run `npm run api:seed`: it must do nothing (no duplicate rows).

- [ ] **Step 8: Commit**

```bash
git add code/public/api/src/CookbookData.php code/public/api/db/seeds code/package.json code/api-tests/CookbookDataTest.php code/api-tests/CookbookSeedTest.php
git commit -m "feat(api): add cookbook seeder and mysqldump script"
```

---

### Task 7: Runtime wiring and smoke test

**Files:**
- Create: `public/api/index.php`, `public/api/router.php`, `public/api/config.local.php.example`, `public/api/.htaccess`
- Modify: `package.json` (`api` script)
- Test: `api-tests/RuntimeFilesTest.php` (guards the `.htaccess` rules); manual curl smoke test

**Interfaces:**
- Consumes: `App::create`, `Database::connect`, `config.php` (Task 1).
- Produces: a runnable API at `/api/*` and the npm script `api`.

- [ ] **Step 1: Write the failing guard test**

`api-tests/RuntimeFilesTest.php`:

```php
<?php
declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class RuntimeFilesTest extends TestCase
{
    private const API = __DIR__ . '/../public/api';

    public function testHtaccessBlocksInternalsAndRoutesTheRestToSlim(): void
    {
        $rules = file_get_contents(self::API . '/.htaccess');

        $this->assertStringContainsString('(vendor|src|db|bin)', $rules);
        $this->assertStringContainsString('config\.local\.php', $rules);
        $this->assertStringContainsString('phinx\.php', $rules);
        $this->assertStringContainsString('RewriteRule ^ index.php', $rules);
    }

    public function testExampleConfigIsCommittedButLocalConfigIsIgnored(): void
    {
        $this->assertFileExists(self::API . '/config.local.php.example');
        $this->assertStringContainsString('public/api/config.local.php', file_get_contents(__DIR__ . '/../.gitignore'));
    }

    public function testDefaultConfigPointsAtTheLocalDevelopmentDatabase(): void
    {
        $config = require self::API . '/config.php';

        $this->assertSame('meal_planner', $config['db']['database']);
    }
}
```

Run: `npm run test:php`. Expected: FAIL (files missing).

- [ ] **Step 2: Create the runtime files**

`public/api/.htaccess`:

```apache
RewriteEngine On

# Internals are never served over HTTP.
RewriteRule ^(vendor|src|db|bin)(/|$) - [F,L]
RewriteRule ^(config\.local\.php|config\.php|phinx\.php|composer\.json|composer\.lock)$ - [F,L]

# Real files (fetch-recipe.php) are served as-is; everything else is the Slim app.
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.php [QSA,L]
```

`public/api/index.php`:

```php
<?php
// code/public/api/index.php: Slim front controller for /api/*
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

ini_set('display_errors', '0'); // a PHP warning must never corrupt the JSON body

use MealPlanner\Api\App;
use MealPlanner\Api\Database;

$config = require __DIR__ . '/config.php';

App::create(Database::connect($config['db']))->run();
```

`public/api/config.local.php.example`:

```php
<?php
// Copy to config.local.php on the server (never commit the copy) and fill in the host's MySQL details.
declare(strict_types=1);

return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'database' => 'CHANGE_ME',
        'username' => 'CHANGE_ME',
        'password' => 'CHANGE_ME',
    ],
];
```

`public/api/router.php`:

```php
<?php
// Router for the PHP built-in server (`npm run api`): everything under /api that is not a real file goes to the Slim app.
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if (str_starts_with($path, '/api/') && !is_file(__DIR__ . substr($path, strlen('/api')))) {
    require __DIR__ . '/index.php';

    return true;
}

return false; // fetch-recipe.php and static files are served by the built-in server itself
```

In `code/package.json` replace the `"api"` script with:

```json
    "api": "php -S localhost:8080 -t public public/api/router.php",
```

- [ ] **Step 3: Run to verify pass**

Run: `npm run test:php`
Expected: PASS (all classes).

- [ ] **Step 4: Smoke test against the real server (local MySQL seeded in Task 6)**

```bash
cd /data/code
npm run api:reset
npm run api &               # php -S on :8080
curl -s localhost:8080/api/ingredients | head -c 200
curl -s localhost:8080/api/recipes | head -c 200
curl -s -X POST localhost:8080/api/tags -H 'content-type: application/json' -d '{"name":"smoke","color":"#fff"}'
curl -s -i localhost:8080/api/nope | head -n 1
curl -s 'localhost:8080/api/fetch-recipe.php'      # existing endpoint still served by its own script
kill %1
```

Expected: ingredient and recipe JSON arrays (163 and 53 entries when piped through `jq length`), a JSON tag with a generated id, `HTTP/1.1 404` for `/api/nope`, and `{"error":"bad_url"}` from `fetch-recipe.php`.

- [ ] **Step 5: Confirm the production build story**

Run: `composer install --working-dir=public/api --no-dev --optimize-autoloader && ls public/api/vendor/bin 2>&1 | head`
Expected: no `phinx` in `vendor/bin` (dev dependency not installed). Restore dev dependencies afterwards with `npm run api:install`. This `--no-dev` install is what must precede `npm run build` when preparing a deploy (documented in plan 4).

- [ ] **Step 6: Commit**

```bash
git add code/public/api/index.php code/public/api/router.php code/public/api/config.local.php.example code/public/api/.htaccess code/package.json code/api-tests/RuntimeFilesTest.php
git commit -m "feat(api): wire up front controller, dev router and htaccess"
```

---

## Self-Review

**Spec coverage**
- Slim v4 front controller, Composer deps, FTP-uploaded `vendor/` (built `--no-dev`) → Tasks 1, 7.
- Phinx migrations applied via phpMyAdmin; Phinx seeder; `utf8mb4`/InnoDB → Tasks 1, 6.
- `.htaccess` rewriting only non-existing paths; `fetch-recipe.php` untouched → Task 7 (rules + smoke test).
- Dev `php -S` router reusing the existing Vite proxy (no CORS middleware) → Task 7.
- REST resources, full CRUD: recipes, tags, ingredients, pantry, meal plan → Tasks 2 to 5; atomic `PUT /api/pantry/batch` → Task 4.
- `{"error": code}` convention → Task 2 handler.
- Client-generated UUID ids → `Input::newId`.
- Schema with `user_id`, no unit column on `recipe_ingredients` → Task 1.
- Seed from `cookbookSeed.json`, reusing the name-to-id / tag / emoji logic → Task 6; production SQL via `mysqldump` → Task 6.
- PHPUnit with in-memory SQLite → every task, via `TestDatabase` (the real Phinx migration).
- **Not in this plan (by design, later plans):** frontend `api/client.ts`, TanStack Query hooks, removing localStorage services, `importCookbookIfNeeded`, `QueryClientProvider`, doc updates (`BACKEND-STACK.md`, `ALPHA-DEPLOY.md`, `STACK.md`, `COOKBOOK-IMPORT-WIRING.md`, `AGENTS.md` tree).

**Placeholder scan:** none; every step carries code or an exact command. The one conditional (the `TestDatabase` temp-file fallback in Task 1, step 7) names the exact replacement.

**Type consistency:** `Input::*` names (`str`, `text`, `integer`, `number`, `boolean`, `oneOf`, `date`, `id`, `newId`) are used identically in all repositories; `ApiError::invalid()/notFound()`, `errorCode`, `httpStatus()` match between Task 2 and later tasks; `Database::USER_ID`, `Database::fromPdo`, `TestDatabase::create()/seed()/connection()`, `CookbookData::rows` are referenced consistently; JSON field names match `code/src/types/*.ts`.

**Known risks:** PHP and MySQL are not installed in this environment (Task 0); the code has not been executed, so Slim / illuminate / Phinx version quirks (Phinx's `connection` option on in-memory SQLite, SQLite foreign keys, 405 handling) are guarded by tests that will surface them on first run, with a documented fallback for the first. The production host's PHP version and MySQL access are unverified (ALPHA-DEPLOY steps 5 to 11); `illuminate/database ^10` needs PHP 8.1+.
