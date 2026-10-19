<?php
// Router for the PHP built-in server (`npm run api`): everything under /api that is not a real file goes to the Slim app.
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if (str_starts_with($path, '/api/') && !is_file(__DIR__ . substr($path, strlen('/api')))) {
    require __DIR__ . '/index.php';

    return true;
}

return false; // fetch-recipe.php and static files are served by the built-in server itself
