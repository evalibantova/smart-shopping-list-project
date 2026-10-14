<?php
// code/api-tests/PageFetcherTest.php
declare(strict_types=1);

use MealPlanner\Api\FetchError;
use MealPlanner\Api\PageFetcher;
use PHPUnit\Framework\TestCase;

final class PageFetcherTest extends TestCase
{
    private static function resolver(): callable
    {
        return fn (string $host): array => $host === 'internal.example' ? ['10.0.0.5'] : ['93.184.216.34'];
    }

    private static function html(string $body = '<html><body>hi</body></html>', string $type = 'text/html; charset=utf-8'): array
    {
        return ['status' => 200, 'headers' => ['content-type' => $type], 'body' => $body];
    }

    private function code(callable $fn): string
    {
        try {
            $fn();
        } catch (FetchError $e) {
            return $e->errorCode;
        }
        return 'none';
    }

    public function testReturnsTheBody(): void
    {
        $fetcher = new PageFetcher(fn (string $url, array $t): array => self::html(), self::resolver());
        $this->assertSame('<html><body>hi</body></html>', $fetcher->fetch('http://good.example/a'));
    }

    public function testConvertsLatin2ToUtf8(): void
    {
        $body = iconv('UTF-8', 'ISO-8859-2', '<html><body>Múka</body></html>');
        $fetcher = new PageFetcher(
            fn (string $url, array $t): array => self::html($body, 'text/html; charset=iso-8859-2'),
            self::resolver(),
        );
        $this->assertStringContainsString('Múka', $fetcher->fetch('http://good.example/'));
    }

    public function testFollowsAbsoluteAndRelativeRedirects(): void
    {
        $urls = [];
        $transport = function (string $url, array $t) use (&$urls): array {
            $urls[] = $url;
            return match (count($urls)) {
                1 => ['status' => 301, 'headers' => ['location' => 'https://good.example/b/c'], 'body' => ''],
                2 => ['status' => 302, 'headers' => ['location' => 'd'], 'body' => ''],
                default => self::html(),
            };
        };
        (new PageFetcher($transport, self::resolver()))->fetch('http://good.example/a');
        $this->assertSame(['http://good.example/a', 'https://good.example/b/c', 'https://good.example/b/d'], $urls);
    }

    public function testBlocksARedirectToAPrivateIpLiteral(): void
    {
        $calls = 0;
        $transport = function (string $url, array $t) use (&$calls): array {
            $calls++;
            return ['status' => 302, 'headers' => ['location' => 'http://127.0.0.1/admin'], 'body' => ''];
        };
        $code = $this->code(fn () => (new PageFetcher($transport, self::resolver()))->fetch('http://good.example/'));
        $this->assertSame('blocked_host', $code);
        $this->assertSame(1, $calls, 'the private target must never be requested');
    }

    public function testBlocksARedirectToAHostnameThatResolvesPrivate(): void
    {
        $transport = fn (string $url, array $t): array => [
            'status' => 302,
            'headers' => ['location' => 'http://internal.example/'],
            'body' => '',
        ];
        $code = $this->code(fn () => (new PageFetcher($transport, self::resolver()))->fetch('http://good.example/'));
        $this->assertSame('blocked_host', $code);
    }

    public function testGivesUpAfterThreeRedirects(): void
    {
        $calls = 0;
        $transport = function (string $url, array $t) use (&$calls): array {
            $calls++;
            return ['status' => 302, 'headers' => ['location' => 'http://good.example/next'], 'body' => ''];
        };
        $code = $this->code(fn () => (new PageFetcher($transport, self::resolver()))->fetch('http://good.example/'));
        $this->assertSame('fetch_failed', $code);
        $this->assertSame(4, $calls);
    }

    public function testRejectsNonHtmlAndHttpErrors(): void
    {
        $json = new PageFetcher(fn (string $u, array $t): array => self::html('{}', 'application/json'), self::resolver());
        $this->assertSame('fetch_failed', $this->code(fn () => $json->fetch('http://good.example/')));

        $notFound = new PageFetcher(
            fn (string $u, array $t): array => ['status' => 404, 'headers' => ['content-type' => 'text/html'], 'body' => 'x'],
            self::resolver(),
        );
        $this->assertSame('fetch_failed', $this->code(fn () => $notFound->fetch('http://good.example/')));
    }

    public function testPassesTheTransportARemainingTimeoutBetweenOneAndTen(): void
    {
        $timeouts = [];
        $transport = function (string $url, array $t, int $timeout) use (&$timeouts): array {
            $timeouts[] = $timeout;
            return count($timeouts) === 1
                ? ['status' => 302, 'headers' => ['location' => 'http://good.example/b'], 'body' => '']
                : self::html();
        };
        (new PageFetcher($transport, self::resolver()))->fetch('  http://good.example/a  ');
        $this->assertCount(2, $timeouts);
        foreach ($timeouts as $timeout) {
            $this->assertGreaterThanOrEqual(1, $timeout);
            $this->assertLessThanOrEqual(10, $timeout);
        }
        $this->assertGreaterThanOrEqual($timeouts[1], $timeouts[0]);
    }

    public function testRejectsAnOversizeBody(): void
    {
        $big = str_repeat('a', PageFetcher::MAX_BYTES + 1);
        $fetcher = new PageFetcher(fn (string $u, array $t): array => self::html($big), self::resolver());
        $this->assertSame('too_large', $this->code(fn () => $fetcher->fetch('http://good.example/')));
    }
}
