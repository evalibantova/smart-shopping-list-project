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
