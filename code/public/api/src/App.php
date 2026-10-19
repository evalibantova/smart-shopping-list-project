<?php
declare(strict_types=1);

namespace MealPlanner\Api;

use Illuminate\Database\Connection;
use Illuminate\Database\QueryException;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App as SlimApp;
use Slim\Exception\HttpMethodNotAllowedException;
use Slim\Exception\HttpNotFoundException;
use Slim\Factory\AppFactory;

final class App
{
    public static function create(Connection $db): SlimApp
    {
        $ingredients = new IngredientRepository($db);
        $tags = new TagRepository($db);
        $recipes = new RecipeRepository($db);
        $pantry = new PantryRepository($db);
        $mealPlan = new MealPlanRepository($db);

        $json = static function (Response $response, mixed $data, int $status = 200): Response {
            $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));

            return $response
                ->withStatus($status)
                ->withHeader('Content-Type', 'application/json; charset=utf-8')
                ->withHeader('Cache-Control', 'no-store');
        };

        $app = AppFactory::create();
        $app->setBasePath('/api');
        $app->addRoutingMiddleware();

        $app->get('/ingredients', fn (Request $q, Response $r) => $json($r, $ingredients->all()));
        $app->post('/ingredients', fn (Request $q, Response $r) => $json($r, $ingredients->create(Input::body($q)), 201));
        $app->put('/ingredients/{id}', fn (Request $q, Response $r, array $args) => $json($r, $ingredients->update($args['id'], Input::body($q))));
        $app->delete('/ingredients/{id}', function (Request $q, Response $r, array $args) use ($ingredients) {
            $ingredients->delete($args['id']);

            return $r->withStatus(204);
        });

        $app->get('/tags', fn (Request $q, Response $r) => $json($r, $tags->all()));
        $app->post('/tags', fn (Request $q, Response $r) => $json($r, $tags->create(Input::body($q)), 201));
        $app->put('/tags/{id}', fn (Request $q, Response $r, array $args) => $json($r, $tags->update($args['id'], Input::body($q))));
        $app->delete('/tags/{id}', function (Request $q, Response $r, array $args) use ($tags) {
            $tags->delete($args['id']);

            return $r->withStatus(204);
        });

        $app->get('/recipes', fn (Request $q, Response $r) => $json($r, $recipes->all()));
        $app->post('/recipes', fn (Request $q, Response $r) => $json($r, $recipes->create(Input::body($q)), 201));
        $app->put('/recipes/{id}', fn (Request $q, Response $r, array $args) => $json($r, $recipes->update($args['id'], Input::body($q))));
        $app->delete('/recipes/{id}', function (Request $q, Response $r, array $args) use ($recipes) {
            $recipes->delete($args['id']);

            return $r->withStatus(204);
        });

        $app->get('/pantry', fn (Request $q, Response $r) => $json($r, $pantry->all()));
        $app->post('/pantry', fn (Request $q, Response $r) => $json($r, $pantry->create(Input::body($q)), 201));
        $app->put('/pantry/batch', fn (Request $q, Response $r) => $json($r, $pantry->adjust(Input::body($q))));
        $app->put('/pantry/{id}', fn (Request $q, Response $r, array $args) => $json($r, $pantry->update($args['id'], Input::body($q))));
        $app->delete('/pantry/{id}', function (Request $q, Response $r, array $args) use ($pantry) {
            $pantry->delete($args['id']);

            return $r->withStatus(204);
        });

        $app->get('/meal-plan', fn (Request $q, Response $r) => $json($r, $mealPlan->all()));
        $app->post('/meal-plan', fn (Request $q, Response $r) => $json($r, $mealPlan->create(Input::body($q)), 201));
        $app->put('/meal-plan/{id}', fn (Request $q, Response $r, array $args) => $json($r, $mealPlan->update($args['id'], Input::body($q))));
        $app->delete('/meal-plan/{id}', function (Request $q, Response $r, array $args) use ($mealPlan) {
            $mealPlan->delete($args['id']);

            return $r->withStatus(204);
        });

        $errors = $app->addErrorMiddleware(false, false, false);
        $errors->setDefaultErrorHandler(static function (Request $request, \Throwable $e) use ($app, $json): Response {
            [$status, $code] = match (true) {
                $e instanceof ApiError => [$e->httpStatus(), $e->errorCode],
                $e instanceof HttpNotFoundException => [404, 'not_found'],
                $e instanceof HttpMethodNotAllowedException => [405, 'bad_method'],
                // 23000 = integrity constraint (duplicate key, unknown foreign key)
                $e instanceof QueryException && (string) $e->getCode() === '23000' => [409, 'conflict'],
                default => [500, 'server_error'],
            };
            if ($status === 500) {
                error_log((string) $e);
            }

            return $json($app->getResponseFactory()->createResponse(), ['error' => $code], $status);
        });

        return $app;
    }
}
