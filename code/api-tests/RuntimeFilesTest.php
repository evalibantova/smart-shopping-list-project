<?php
declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class RuntimeFilesTest extends TestCase
{
    private const API = __DIR__ . '/../public/api';

    public function testHtaccessBlocksInternalsAndRoutesTheRestToSlim(): void
    {
        $rules = file_get_contents(self::API . '/.htaccess');

        $this->assertStringContainsString('(vendor|src|db|bin)', $rules);
        $this->assertStringContainsString('config\.local\.php', $rules);
        $this->assertStringContainsString('phinx\.php', $rules);
        $this->assertStringContainsString('RewriteRule ^ index.php', $rules);
    }

    public function testExampleConfigIsCommittedButLocalConfigIsIgnored(): void
    {
        $this->assertFileExists(self::API . '/config.local.php.example');
        $this->assertStringContainsString('public/api/config.local.php', file_get_contents(__DIR__ . '/../.gitignore'));
    }

    public function testDefaultConfigPointsAtTheLocalDevelopmentDatabase(): void
    {
        $config = require self::API . '/config.php';

        $this->assertSame(['host', 'port', 'database', 'username', 'password'], array_keys($config['db']));
        $this->assertIsString($config['db']['host']);
        $this->assertIsInt($config['db']['port']);
        $this->assertIsString($config['db']['database']);

        // The documented defaults live in config.php itself, independent of any config.local.php.
        $source = file_get_contents(self::API . '/config.php');
        $this->assertStringContainsString("'database' => 'meal_planner'", $source);
        $this->assertStringContainsString("'host' => '127.0.0.1'", $source);
    }

    public function testFrontControllerAnswersADatabaseOutageWithJsonAndNeverLeaksTheError(): void
    {
        $source = file_get_contents(self::API . '/index.php');

        $this->assertLessThan(strpos($source, 'vendor/autoload.php'), strpos($source, "ini_set('display_errors', '0')"));
        $this->assertStringContainsString('catch (\Throwable', $source);
        $this->assertStringContainsString('error_log(', $source);
        $this->assertStringContainsString('{"error":"server_error"}', $source);
    }
}
