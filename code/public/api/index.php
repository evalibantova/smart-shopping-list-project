<?php
// code/public/api/index.php: Slim front controller for /api/*
declare(strict_types=1);

ini_set('display_errors', '0'); // a PHP warning must never corrupt the JSON body

require __DIR__ . '/vendor/autoload.php';

use MealPlanner\Api\App;
use MealPlanner\Api\Database;

$config = require __DIR__ . '/config.php';

try {
    $db = Database::connect($config['db']);
} catch (\Throwable $e) {
    error_log('Database connection failed: ' . $e->getMessage()); // log only, never output
    http_response_code(500);
    header('Content-Type: application/json');
    echo '{"error":"server_error"}';
    exit;
}

App::create($db)->run();
