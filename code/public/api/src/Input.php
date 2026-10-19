<?php
declare(strict_types=1);

namespace MealPlanner\Api;

use Psr\Http\Message\ServerRequestInterface;

/** Request-body parsing. Every failure is an ApiError::invalid() (422). */
final class Input
{
    public const MAX_SERVINGS = 1_000_000;
    private const MAX_NUMBER = 1e9;
    private const UUID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';

    /** @return array<string, mixed> */
    public static function body(ServerRequestInterface $request): array
    {
        $data = json_decode((string) $request->getBody(), true);
        if (!is_array($data) || array_is_list($data)) {
            throw ApiError::invalid();
        }

        return $data;
    }

    /** Non-empty string of at most $max characters. */
    public static function str(array $data, string $key, int $max): string
    {
        $value = $data[$key] ?? null;
        if (!is_string($value) || $value === '' || mb_strlen($value) > $max) {
            throw ApiError::invalid();
        }

        return $value;
    }

    /** String that may be empty (e.g. recipe notes), of at most $max characters. */
    public static function text(array $data, string $key, int $max = 20000): string
    {
        $value = $data[$key] ?? null;
        if (!is_string($value) || mb_strlen($value) > $max) {
            throw ApiError::invalid();
        }

        return $value;
    }

    public static function integer(array $data, string $key, int $min, int $max = PHP_INT_MAX): int
    {
        $value = $data[$key] ?? null;
        if (!is_int($value) || $value < $min || $value > $max) {
            throw ApiError::invalid();
        }

        return $value;
    }

    /** Number between 0 and 1e9 (the column is a double; this keeps clients honest). */
    public static function number(array $data, string $key): float
    {
        $value = $data[$key] ?? null;
        if ((!is_int($value) && !is_float($value)) || $value < 0 || $value > self::MAX_NUMBER) {
            throw ApiError::invalid();
        }

        return (float) $value;
    }

    public static function boolean(array $data, string $key): bool
    {
        $value = $data[$key] ?? null;
        if (!is_bool($value)) {
            throw ApiError::invalid();
        }

        return $value;
    }

    /** @param list<string> $allowed */
    public static function oneOf(array $data, string $key, array $allowed): string
    {
        $value = $data[$key] ?? null;
        if (!is_string($value) || !in_array($value, $allowed, true)) {
            throw ApiError::invalid();
        }

        return $value;
    }

    /** A real calendar date as YYYY-MM-DD. */
    public static function date(array $data, string $key): string
    {
        $value = $data[$key] ?? null;
        if (!is_string($value) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m) || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            throw ApiError::invalid();
        }

        return $value;
    }

    /** Required UUID string. */
    public static function id(array $data, string $key): string
    {
        $value = $data[$key] ?? null;
        if (!is_string($value) || !preg_match(self::UUID, $value)) {
            throw ApiError::invalid();
        }

        return $value;
    }

    /** Optional client-supplied `id` (so optimistic updates keep stable ids); generated when absent. */
    public static function newId(array $data): string
    {
        return array_key_exists('id', $data) ? self::id($data, 'id') : Uuid::v4();
    }
}
