<?php
declare(strict_types=1);

namespace MealPlanner\Api;

use Psr\Http\Message\ServerRequestInterface;

/** Request-body parsing. Every failure is an ApiError::invalid() (422). */
final class Input
{
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

    /** String that may be empty (e.g. recipe notes). */
    public static function text(array $data, string $key): string
    {
        $value = $data[$key] ?? null;
        if (!is_string($value)) {
            throw ApiError::invalid();
        }

        return $value;
    }

    public static function integer(array $data, string $key, int $min): int
    {
        $value = $data[$key] ?? null;
        if (!is_int($value) || $value < $min) {
            throw ApiError::invalid();
        }

        return $value;
    }

    /** Number >= 0. */
    public static function number(array $data, string $key): float
    {
        $value = $data[$key] ?? null;
        if ((!is_int($value) && !is_float($value)) || $value < 0) {
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
