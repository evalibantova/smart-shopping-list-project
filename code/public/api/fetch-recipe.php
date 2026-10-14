<?php
// code/public/api/fetch-recipe.php
declare(strict_types=1);

require_once __DIR__ . '/src/FetchError.php';
require_once __DIR__ . '/src/UrlGuard.php';
require_once __DIR__ . '/src/PageFetcher.php';
require_once __DIR__ . '/src/RecipeExtractor.php';

ini_set('display_errors', '0'); // a PHP warning must never corrupt the JSON body

use MealPlanner\Api\FetchError;
use MealPlanner\Api\PageFetcher;
use MealPlanner\Api\RecipeExtractor;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'bad_url']);
    exit;
}

$url = $_GET['url'] ?? '';
if (!is_string($url)) {
    http_response_code(400);
    echo json_encode(['error' => 'bad_url']);
    exit;
}

try {
    $html = (new PageFetcher())->fetch($url);
    echo json_encode(
        RecipeExtractor::extract($html),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
    );
} catch (FetchError $e) {
    http_response_code($e->httpStatus());
    echo json_encode(['error' => $e->errorCode]);
} catch (\Throwable) {
    http_response_code(502);
    echo json_encode(['error' => 'fetch_failed']);
}
