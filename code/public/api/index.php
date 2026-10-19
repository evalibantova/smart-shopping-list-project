<?php
// code/public/api/index.php: Slim front controller for /api/*
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

ini_set('display_errors', '0'); // a PHP warning must never corrupt the JSON body

use MealPlanner\Api\App;
use MealPlanner\Api\Database;

$config = require __DIR__ . '/config.php';

App::create(Database::connect($config['db']))->run();
