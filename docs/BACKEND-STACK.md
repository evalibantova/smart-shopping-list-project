# Backend Tech Stack

## Decision table

| Layer | Choice | Notes |
|---|---|---|
| Framework | Slim Framework v4 | Single front controller, PSR-7 middleware, proper routing — runs on any shared PHP host |
| Runtime | PHP 8.1+ | Minimum for Slim v4; pin to match server version exactly |
| Database | MySQL via PDO | Shared host constraint; prepared statements only |
| Query layer | `illuminate/database` (standalone) | Query builder without Laravel overhead; no Artisan, no full ORM |
| DI container | `php-di/php-di` v7 | Injects DB into action classes; avoids globals |
| CORS | `tuupola/cors-middleware` | Dev only (Vite ↔ API on different ports); same-origin in production |
| Migrations | Phinx (dev-only) | Run locally → generates numbered SQL → applied via phpMyAdmin on server |
| Seed data | Phinx seeder | 76 canonical ingredients pre-loaded on first deploy |
| Testing | PHPUnit v11 | Unit tests for aggregation logic; SQLite in-memory for DB tests |

## Key constraints driving these decisions

- **Shared hosting** — FTP deploy only; no SSH, no `composer install` on server. `vendor/` built locally and uploaded via `lftp mirror` (diff-only transfer after first deploy).
- **No unit column in `recipe_ingredients`** — unit is always read from `ingredients.default_unit`; enforced at schema level, not application logic.
- **Shopping list is not a backend endpoint** — live-computed client-side from meal plan + recipes + pantry. Server stays stateless on the most complex calculation.
- **Phinx never runs on the server** — schema changes go through local Phinx → SQL file → phpMyAdmin. Phinx is `require-dev` only and excluded from the production `vendor/` upload.
- **Path to JWT auth** — `tuupola/slim-jwt-auth` middleware drops in without restructuring routes when multi-user is introduced.
