<?php
declare(strict_types=1);

namespace MealPlanner\Api;

final class ApiError extends \RuntimeException
{
    public function __construct(public readonly string $errorCode, private readonly int $status)
    {
        parent::__construct($errorCode);
    }

    public function httpStatus(): int
    {
        return $this->status;
    }

    public static function invalid(): self
    {
        return new self('invalid', 422);
    }

    public static function notFound(): self
    {
        return new self('not_found', 404);
    }
}
