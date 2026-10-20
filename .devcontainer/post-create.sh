#!/usr/bin/env bash
# Runs once after the devcontainer is created. Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/../code"

# PHPUnit (no Composer for the test runner, see docs/STACK.md)
[ -f phpunit.phar ] || curl -sSL https://phar.phpunit.de/phpunit-11.phar -o phpunit.phar

# PHP and pdo_mysql come from apt (see .devcontainer/Dockerfile). Fail loudly when the container
# was not rebuilt from it. (php -m goes into a variable: grep -q closing the pipe early would SIGPIPE it.)
if ! php -r 'exit(PHP_VERSION_ID >= 80200 ? 0 : 1);'; then
  echo "PHP 8.2 or newer is required (the phpunit-11 phar needs it); found $(php -r 'echo PHP_VERSION;')." >&2
  exit 1
fi
php_modules="$(php -m)"
if ! grep -qx pdo_mysql <<<"$php_modules"; then
  echo "pdo_mysql is missing: rebuild the devcontainer so .devcontainer/Dockerfile is applied." >&2
  exit 1
fi
grep -x pdo_mysql <<<"$php_modules"
