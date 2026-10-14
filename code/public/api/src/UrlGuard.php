<?php
// code/public/api/src/UrlGuard.php
declare(strict_types=1);

namespace MealPlanner\Api;

final class UrlGuard
{
    /**
     * Validate a URL and resolve its host to public IPs only.
     *
     * @param null|callable(string): list<string> $resolver host -> IPs (injectable for tests)
     * @return array{scheme: string, host: string, port: int, ip: string}
     */
    public static function check(string $url, ?callable $resolver = null): array
    {
        $parts = parse_url(trim($url));
        if ($parts === false || !isset($parts['scheme'], $parts['host'])) {
            throw new FetchError('bad_url');
        }

        $scheme = strtolower($parts['scheme']);
        if ($scheme !== 'http' && $scheme !== 'https') {
            throw new FetchError('bad_url');
        }
        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new FetchError('bad_url');
        }

        $port = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);
        if ($port !== 80 && $port !== 443) {
            throw new FetchError('blocked_host');
        }

        $host = strtolower(trim($parts['host'], '[]'));
        if ($host === '' || $host === 'localhost' || str_ends_with($host, '.localhost')) {
            throw new FetchError('blocked_host');
        }

        $ips = filter_var($host, FILTER_VALIDATE_IP) !== false
            ? [$host]
            : ($resolver ?? [self::class, 'resolve'])($host);
        if ($ips === []) {
            throw new FetchError('fetch_failed');
        }
        foreach ($ips as $ip) {
            if (!self::isPublicIp($ip)) {
                throw new FetchError('blocked_host');
            }
        }

        return ['scheme' => $scheme, 'host' => $host, 'port' => $port, 'ip' => $ips[0]];
    }

    public static function isPublicIp(string $ip): bool
    {
        // ::ffff:a.b.c.d is IPv4 in disguise: judge the embedded address. Hex forms are refused.
        if (stripos($ip, '::ffff:') === 0) {
            $v4 = substr($ip, 7);
            return filter_var($v4, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false && self::isPublicIp($v4);
        }

        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
    }

    /** @return list<string> IPv4 first, then IPv6 */
    public static function resolve(string $host): array
    {
        $ips = gethostbynamel($host) ?: [];
        $records = @dns_get_record($host, DNS_AAAA);
        if (is_array($records)) {
            foreach ($records as $record) {
                if (isset($record['ipv6'])) {
                    $ips[] = $record['ipv6'];
                }
            }
        }

        return array_values($ips);
    }
}
