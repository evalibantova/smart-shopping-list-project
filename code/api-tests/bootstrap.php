<?php
// code/api-tests/bootstrap.php
// The endpoint has no autoloader (no Composer on the server), so tests load the files the same way it does.
declare(strict_types=1);

foreach (['FetchError', 'UrlGuard', 'PageFetcher', 'RecipeExtractor'] as $class) {
    require_once __DIR__ . '/../public/api/src/' . $class . '.php';
}
