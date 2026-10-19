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

        $this->assertSame('meal_planner', $config['db']['database']);
    }
}
