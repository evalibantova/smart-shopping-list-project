<?php
// code/public/api/src/PageFetcher.php
declare(strict_types=1);

namespace MealPlanner\Api;

final class PageFetcher
{
    public const MAX_BYTES = 2_097_152;
    public const MAX_REDIRECTS = 3;
    public const TIMEOUT_SECONDS = 10;

    /** @var callable(string, array): array{status: int, headers: array<string, string>, body: string} */
    private $transport;
    /** @var null|callable(string): list<string> */
    private $resolver;

    /**
     * @param null|callable $transport (url, UrlGuard target) -> status/headers/body; defaults to curl
     * @param null|callable $resolver  host -> IPs; defaults to DNS
     */
    public function __construct(?callable $transport = null, ?callable $resolver = null)
    {
        $this->transport = $transport ?? [self::class, 'curlTransport'];
        $this->resolver = $resolver;
    }

    /** Fetch a page and return its HTML as UTF-8. Every hop, including redirects, goes through UrlGuard. */
    public function fetch(string $url): string
    {
        $url = trim($url); // check() and curl must see the very same string
        $deadline = microtime(true) + self::TIMEOUT_SECONDS; // one budget for the whole fetch, redirects included

        for ($hop = 0; $hop <= self::MAX_REDIRECTS; $hop++) {
            $remaining = (int) floor($deadline - microtime(true));
            if ($remaining < 1) {
                throw new FetchError('fetch_failed');
            }
            $target = UrlGuard::check($url, $this->resolver);
            $res = ($this->transport)($url, $target, $remaining);

            if (in_array($res['status'], [301, 302, 303, 307, 308], true)) {
                $location = $res['headers']['location'] ?? '';
                if ($location === '') {
                    throw new FetchError('fetch_failed');
                }
                $url = self::resolveLocation($url, $location);
                continue;
            }

            if ($res['status'] < 200 || $res['status'] >= 300) {
                throw new FetchError('fetch_failed');
            }
            $type = strtolower($res['headers']['content-type'] ?? '');
            if (!str_contains($type, 'text/html') && !str_contains($type, 'application/xhtml')) {
                throw new FetchError('fetch_failed');
            }
            if (strlen($res['body']) > self::MAX_BYTES) {
                throw new FetchError('too_large');
            }

            return self::toUtf8($res['body'], $type);
        }

        throw new FetchError('fetch_failed'); // too many redirects
    }

    /** Default transport. Pins the connection to the IP UrlGuard validated (no DNS rebinding). */
    public static function curlTransport(string $url, array $target, int $timeoutSeconds = self::TIMEOUT_SECONDS): array
    {
        $headers = [];
        $body = '';
        $tooLarge = false;
        $timeout = max(1, $timeoutSeconds);

        $ch = curl_init(trim($url));
        $options = [
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROXY => '', // an environment http_proxy must not defeat the IP pin
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => min(5, $timeout),
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; MealPlannerImport/1.0)',
            CURLOPT_ENCODING => '',
            CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml'],
            CURLOPT_HEADERFUNCTION => function ($c, string $line) use (&$headers): int {
                $pos = strpos($line, ':');
                if ($pos !== false) {
                    $headers[strtolower(trim(substr($line, 0, $pos)))] = trim(substr($line, $pos + 1));
                }
                return strlen($line);
            },
            CURLOPT_WRITEFUNCTION => function ($c, string $chunk) use (&$body, &$tooLarge): int {
                $body .= $chunk;
                if (strlen($body) > self::MAX_BYTES) {
                    $tooLarge = true;
                    return 0; // abort the transfer
                }
                return strlen($chunk);
            },
        ];
        // Pin the connection to the validated IP. Not needed (and fiddly for IPv6) when the host already is an IP literal.
        if (filter_var($target['host'], FILTER_VALIDATE_IP) === false) {
            $options[CURLOPT_RESOLVE] = [$target['host'] . ':' . $target['port'] . ':' . (str_contains($target['ip'], ':') ? '[' . $target['ip'] . ']' : $target['ip'])];
        }
        curl_setopt_array($ch, $options);
        $ok = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($tooLarge) {
            throw new FetchError('too_large');
        }
        if ($ok === false) {
            throw new FetchError('fetch_failed');
        }

        return ['status' => $status, 'headers' => $headers, 'body' => $body];
    }

    private static function resolveLocation(string $base, string $location): string
    {
        if (preg_match('#^[a-z][a-z0-9+.-]*:#i', $location) === 1) {
            return $location; // absolute: UrlGuard will reject non-http schemes
        }
        $p = parse_url($base);
        $origin = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
        if (str_starts_with($location, '//')) {
            return $p['scheme'] . ':' . $location;
        }
        if (str_starts_with($location, '/')) {
            return $origin . $location;
        }
        $dir = rtrim(dirname($p['path'] ?? '/'), '/');

        return $origin . $dir . '/' . $location;
    }

    private static function toUtf8(string $body, string $contentType): string
    {
        $charset = null;
        if (preg_match('/charset=([\w-]+)/i', $contentType, $m) === 1) {
            $charset = $m[1];
        } elseif (preg_match('/<meta[^>]+charset=["\']?([\w-]+)/i', substr($body, 0, 4096), $m) === 1) {
            $charset = $m[1];
        }

        try {
            if ($charset === null) {
                $charset = mb_detect_encoding($body, ['UTF-8', 'ISO-8859-2'], true) ?: 'UTF-8';
            }
            if (in_array(strtolower($charset), ['utf-8', 'utf8'], true)) {
                return $body;
            }
            $out = mb_convert_encoding($body, 'UTF-8', $charset);

            return is_string($out) ? $out : $body;
        } catch (\ValueError) {
            // mbstring does not know this charset name (for example windows-1250): try iconv
            $out = @iconv($charset ?? 'UTF-8', 'UTF-8//IGNORE', $body);

            return is_string($out) ? $out : $body;
        }
    }
}
