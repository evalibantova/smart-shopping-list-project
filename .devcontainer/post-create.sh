#!/usr/bin/env bash
# Runs once after the devcontainer is created. Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/../code"

# PHPUnit (no Composer for the test runner, see docs/STACK.md)
[ -f phpunit.phar ] || curl -sSL https://phar.phpunit.de/phpunit-11.phar -o phpunit.phar

# The php feature builds PHP without pdo_mysql, which the backend needs (Slim API + MySQL).
# Build mysqlnd with SSL ("extended SSL", --with-mysqlnd-ssl); rebuild earlier builds without it.
# This alone did not fix "Bad handshake" against MySQL 8.4, so the dev DB is MariaDB (compose file).
if ! php -m | grep -qx pdo_mysql || ! php --ri mysqlnd | grep -q 'extended SSL => supported'; then
  ver="$(php -r 'echo PHP_VERSION;')"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  echo "Building pdo_mysql for PHP $ver..."
  curl -sSL "https://www.php.net/distributions/php-$ver.tar.xz" | tar -xJ -C "$tmp"
  # The feature's PHP has no mysqlnd (no headers, no symbols), so build it as a shared
  # extension first, then build pdo_mysql against the source tree's mysqlnd headers.
  (
    cd "$tmp/php-$ver/ext/mysqlnd"
    # mysqlnd ships config9.m4 (it is normally built into PHP), which phpize does not look for.
    [ -f config.m4 ] || cp config9.m4 config.m4
    phpize
    ./configure --enable-mysqlnd=shared --with-mysqlnd-ssl
    make -j"$(nproc)"
    make install
  )
  (
    cd "$tmp/php-$ver/ext/pdo_mysql"
    phpize
    CFLAGS="-I$tmp/php-$ver" ./configure --with-pdo-mysql=mysqlnd
    make -j"$(nproc)"
    make install
  )
  ini_dir="$(php -r 'echo PHP_CONFIG_FILE_SCAN_DIR;')"
  # mysqlnd must load before pdo_mysql (ini files load alphabetically).
  echo "extension=mysqlnd.so" > "$ini_dir/mysqlnd.ini"
  echo "extension=pdo_mysql.so" > "$ini_dir/pdo_mysql.ini"
fi

php -m | grep -x pdo_mysql
