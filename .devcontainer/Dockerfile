# Layers PHP on the Claude Code base image. PHP comes from apt: the devcontainer php feature builds PHP
# without pdo_mysql, and a hand-built pdo_mysql could not log in to MariaDB ("Bad handshake").
ARG BASE_IMAGE
FROM ${BASE_IMAGE}

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    php-cli php-mysql php-mbstring php-xml php-curl php-sqlite3 unzip mariadb-client composer \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*
USER claude-user
