<?php
declare(strict_types=1);

namespace MealPlanner\Api;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;

abstract class Repository
{
    public function __construct(protected Connection $db)
    {
    }

    /** Query builder for a user-scoped table, already filtered to the current user. */
    protected function owned(string $table): Builder
    {
        return $this->db->table($table)->where($table . '.user_id', Database::USER_ID);
    }
}
