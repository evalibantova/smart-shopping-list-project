<?php
// code/public/api/src/FetchError.php
declare(strict_types=1);

namespace MealPlanner\Api;

final class FetchError extends \RuntimeException
{
    private const STATUS = [
        'bad_url' => 400,
        'blocked_host' => 403,
        'fetch_failed' => 502,
        'too_large' => 413,
        'no_content' => 422,
    ];

    public function __construct(public readonly string $errorCode)
    {
        parent::__construct($errorCode);
    }

    public function httpStatus(): int
    {
        return self::STATUS[$this->errorCode] ?? 502;
    }
}
