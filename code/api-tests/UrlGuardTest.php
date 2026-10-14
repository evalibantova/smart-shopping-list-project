<?php
// code/api-tests/UrlGuardTest.php
declare(strict_types=1);

use MealPlanner\Api\FetchError;
use MealPlanner\Api\UrlGuard;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class UrlGuardTest extends TestCase
{
    public static function blockedUrls(): array
    {
        return [
            'loopback' => ['http://127.0.0.1/'],
            'private 10' => ['http://10.1.2.3/'],
            'private 192.168' => ['http://192.168.0.5/x'],
            'private 172.16' => ['http://172.16.0.1/'],
            'link-local metadata' => ['http://169.254.169.254/latest/meta-data'],
            'localhost name' => ['http://localhost/'],
            'localhost subdomain' => ['http://app.localhost/'],
            'zero address' => ['http://0.0.0.0/'],
            'ipv6 loopback' => ['http://[::1]/'],
            'ipv4-mapped loopback' => ['http://[::ffff:127.0.0.1]/'],
            'odd port' => ['http://8.8.8.8:22/'],
        ];
    }

    #[DataProvider('blockedUrls')]
    public function testBlocksPrivateAndOddTargets(string $url): void
    {
        try {
            UrlGuard::check($url);
            $this->fail('expected FetchError');
        } catch (FetchError $e) {
            $this->assertSame('blocked_host', $e->errorCode);
        }
    }

    public static function badUrls(): array
    {
        return [
            'ftp' => ['ftp://example.com/'],
            'file' => ['file:///etc/passwd'],
            'javascript' => ['javascript:alert(1)'],
            'not a url' => ['not a url'],
            'empty' => [''],
            'credentials' => ['http://user:pw@example.com/'],
        ];
    }

    #[DataProvider('badUrls')]
    public function testRejectsNonHttpOrMalformedUrls(string $url): void
    {
        try {
            UrlGuard::check($url);
            $this->fail('expected FetchError');
        } catch (FetchError $e) {
            $this->assertSame('bad_url', $e->errorCode);
        }
    }

    public function testAcceptsAPublicIpLiteral(): void
    {
        $target = UrlGuard::check('https://8.8.8.8/x');
        $this->assertSame(['scheme' => 'https', 'host' => '8.8.8.8', 'port' => 443, 'ip' => '8.8.8.8'], $target);
    }

    public function testBlocksAHostnameThatResolvesToAPrivateIp(): void
    {
        $this->expectException(FetchError::class);
        UrlGuard::check('http://evil.example/', fn (string $host): array => ['10.0.0.1']);
    }

    public function testBlocksWhenAnyResolvedIpIsPrivate(): void
    {
        $this->expectException(FetchError::class);
        UrlGuard::check('http://mixed.example/', fn (string $host): array => ['93.184.216.34', '127.0.0.1']);
    }

    public function testAcceptsAHostnameThatResolvesToAPublicIp(): void
    {
        $target = UrlGuard::check('http://good.example/', fn (string $host): array => ['93.184.216.34']);
        $this->assertSame('93.184.216.34', $target['ip']);
        $this->assertSame(80, $target['port']);
    }

    public function testFailsWhenTheHostDoesNotResolve(): void
    {
        try {
            UrlGuard::check('http://nowhere.example/', fn (string $host): array => []);
            $this->fail('expected FetchError');
        } catch (FetchError $e) {
            $this->assertSame('fetch_failed', $e->errorCode);
        }
    }
}
