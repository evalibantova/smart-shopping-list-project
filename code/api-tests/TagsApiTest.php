<?php
declare(strict_types=1);

final class TagsApiTest extends ApiTestCase
{
    public function testCreateAndList(): void
    {
        [$status, $tag] = $this->call('POST', '/api/tags', ['name' => 'Dezert', 'color' => '#F06292']);

        $this->assertSame(201, $status);
        $this->assertSame(['id' => $tag['id'], 'name' => 'Dezert', 'color' => '#F06292'], $tag);
        $this->assertSame([200, [$tag]], $this->call('GET', '/api/tags'));
    }

    public function testRejectsMissingColor(): void
    {
        $this->assertSame([422, ['error' => 'invalid']], $this->call('POST', '/api/tags', ['name' => 'x']));
    }

    public function testDuplicateNameIsAConflict(): void
    {
        $this->makeTag('Snack');

        $this->assertSame([409, ['error' => 'conflict']], $this->call('POST', '/api/tags', ['name' => 'Snack', 'color' => '#fff']));
    }

    public function testUpdateIsPartial(): void
    {
        $id = $this->makeTag('Dezert');

        [$status, $tag] = $this->call('PUT', "/api/tags/$id", ['color' => '#000000']);

        $this->assertSame(200, $status);
        $this->assertSame(['id' => $id, 'name' => 'Dezert', 'color' => '#000000'], $tag);
        $this->assertSame([404, ['error' => 'not_found']], $this->call('PUT', '/api/tags/11111111-2222-4333-8444-555555555555', ['name' => 'x']));
    }

    public function testDeleteRemovesAnUnusedTag(): void
    {
        $id = $this->makeTag('Snack');

        $this->assertSame([204, null], $this->call('DELETE', "/api/tags/$id"));
        $this->assertSame([200, []], $this->call('GET', '/api/tags'));
        $this->assertSame([404, ['error' => 'not_found']], $this->call('DELETE', "/api/tags/$id"));
    }
}
