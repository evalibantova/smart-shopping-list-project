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
