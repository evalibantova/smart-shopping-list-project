<?php
// Uses config.local.php (gitignored; copy config.local.php.example) when present.
// Otherwise the local development MySQL from the plan's prerequisites.
declare(strict_types=1);

$local = __DIR__ . '/config.local.php';

return is_file($local)
    ? require $local
    : ['db' => ['host' => '127.0.0.1', 'port' => 3306, 'database' => 'meal_planner', 'username' => 'meal_planner', 'password' => 'meal_planner']];
