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
