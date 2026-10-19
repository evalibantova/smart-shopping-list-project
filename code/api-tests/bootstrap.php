<?php
// code/api-tests/bootstrap.php
// Classes load through Composer's PSR-4 autoloader (MealPlanner\Api\ => public/api/src/).
declare(strict_types=1);

require __DIR__ . '/../public/api/vendor/autoload.php';

// Test helper (not a test class, so PHPUnit does not discover it).
require_once __DIR__ . '/TestDatabase.php';
