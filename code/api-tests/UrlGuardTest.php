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
            'mapped loopback long form' => ['http://[0:0:0:0:0:ffff:7f00:1]/'],
            'mapped loopback zero-compressed' => ['http://[0::ffff:127.0.0.1]/'],
            'mapped loopback hex' => ['http://[::ffff:7f00:1]/'],
            'mapped metadata hex' => ['http://[::ffff:a9fe:a9fe]/'],
            'nat64' => ['http://[64:ff9b::7f00:1]/'],
            '6to4' => ['http://[2002:7f00:1::1]/'],
            'ipv4-compatible' => ['http://[::127.0.0.1]/'],
            'unique local' => ['http://[fd00::1]/'],
            'ipv6 link-local' => ['http://[fe80::1]/'],
            'carrier-grade nat' => ['http://100.64.0.1/'],
            'benchmarking' => ['http://198.18.0.1/'],
            'ietf protocol block' => ['http://192.0.0.1/'],
            'decimal integer host' => ['http://2130706433/'],
            'hex dotted host' => ['http://0x7f.1/'],
            'octal integer host' => ['http://017700000001/'],
            'short dotted host' => ['http://127.1/'],
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

    public static function parserDifferentialUrls(): array
    {
        return [
            'backslash userinfo to private' => ['http://8.8.8.8\\@127.0.0.1/'],
            'private userinfo to public' => ['http://127.0.0.1\\@8.8.8.8/'],
            'plain userinfo to private' => ['http://user@127.0.0.1/'],
            'fragment hides public host' => ['http://127.0.0.1#@8.8.8.8/'],
        ];
    }

    #[DataProvider('parserDifferentialUrls')]
    public function testParserDifferentialUrlsAreRejectedEvenWithAPublicResolver(string $url): void
    {
        $this->expectException(FetchError::class);
        UrlGuard::check($url, fn (string $host): array => ['93.184.216.34']);
    }

    public function testAcceptsAPublicIpLiteral(): void
    {
        $target = UrlGuard::check('https://8.8.8.8/x');
        $this->assertSame(['scheme' => 'https', 'host' => '8.8.8.8', 'port' => 443, 'ip' => '8.8.8.8'], $target);
    }

    public function testAcceptsAPublicIpv6Literal(): void
    {
        $target = UrlGuard::check('https://[2606:4700:4700::1111]/x');
        $this->assertSame('2606:4700:4700::1111', $target['ip']);
        $this->assertSame(443, $target['port']);
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
