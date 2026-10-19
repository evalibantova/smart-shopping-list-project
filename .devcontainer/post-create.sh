#!/usr/bin/env bash
# Runs once after the devcontainer is created. Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/../code"

# PHPUnit (no Composer for the test runner, see docs/STACK.md)
[ -f phpunit.phar ] || curl -sSL https://phar.phpunit.de/phpunit-11.phar -o phpunit.phar

# PHP and pdo_mysql come from apt (see .devcontainer/Dockerfile). Fail loudly when the container
# was not rebuilt from it.
if ! php -m | grep -qx pdo_mysql; then
  echo "pdo_mysql is missing: rebuild the devcontainer so .devcontainer/Dockerfile is applied." >&2
  exit 1
fi
php -m | grep -x pdo_mysql
