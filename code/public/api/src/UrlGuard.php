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

        $isIpLiteral = filter_var($host, FILTER_VALIDATE_IP) !== false;
        // Numeric spellings such as 2130706433, 0x7f.1, 017700000001 or 127.1 are not valid IPs for
        // filter_var, but a libc resolver would read them as IPv4. Refuse them before any DNS lookup.
        if (!$isIpLiteral && preg_match('/^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+))*$/i', $host) === 1) {
            throw new FetchError('blocked_host');
        }

        $ips = $isIpLiteral
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
        $packed = @inet_pton($ip);
        if ($packed === false) {
            return false;
        }

        if (strlen($packed) === 4) {
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
                return false;
            }
            $long = ip2long($ip);
            if ($long === false) {
                return false;
            }

            return ($long & 0xFFC00000) !== 0x64400000   // 100.64.0.0/10 carrier-grade NAT
                && ($long & 0xFFFFFF00) !== 0xC0000000   // 192.0.0.0/24 IETF protocol assignments
                && ($long & 0xFFFE0000) !== 0xC6120000;  // 198.18.0.0/15 benchmarking
        }

        // IPv6: only global unicast 2000::/3 is public. That excludes ::, ::1, every ::ffff:0:0/96
        // (IPv4-mapped) spelling, ::/96, 64:ff9b::/96 (NAT64), fc00::/7 and fe80::/10 by construction.
        if ((ord($packed[0]) & 0xE0) !== 0x20) {
            return false;
        }
        $prefix32 = substr($packed, 0, 4);
        $prefix16 = substr($packed, 0, 2);

        return $prefix16 !== "\x20\x02"                 // 2002::/16 6to4 (embeds IPv4)
            && $prefix32 !== "\x20\x01\x00\x00"         // 2001::/32 Teredo
            && $prefix32 !== "\x20\x01\x0d\xb8";        // 2001:db8::/32 documentation
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
