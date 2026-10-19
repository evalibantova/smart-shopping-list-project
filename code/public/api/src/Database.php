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
