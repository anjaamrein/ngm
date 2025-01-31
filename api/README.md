# API

## Development

This section describes how to develop the swissgeol viewer api locally leveraging `cargo` and create database migrations.

### Prerequisites

* [Docker](https://docs.docker.com/get-docker/)
* [psql](https://www.postgresql.org/download/)
* [Rust](https://www.rust-lang.org/tools/install)
* [sqlx-cli](https://github.com/launchbadge/sqlx/tree/master/sqlx-cli).

The latter can be installed with the following command

```bash
cargo install sqlx-cli --no-default-features --features rustls,postgres
```

### Quickstart

```bash
# Start the docker-compose development composition
make run
# Run tests
cargo test
# Format
cargo fmt
# Lint
cargo clippy
```

### Database Migrations

To create a reversible migration run

```bash
sqlx migrate add -r <DESCRIPTION>
```

While editing existing migrations already applied, use the following command to reset the database.

```bash
sqlx database reset
```

### `sqlx` offline

To use sqlx macros without access to a running database, use the `offline` feature to create & update the [sqlx-data.json](./sqlx-data.json) file.

This is only required for building production ready containers and can be kept in sync with

```bash
cargo sqlx prepare -- --lib
```
