set dotenv-load

## ------------------------
## Install useful tools
## ------------------------

deps:
    cargo install cargo-watch
    cargo install sqlx-cli --no-default-features --features rust-tls,postgres

## ------------------------
## Code quality functions
## ------------------------

fmt:
    dprint fmt

clippy:
    cargo clippy --all-targets --all-features -- -D warnings

## ------------------------
## Test functions
## ------------------------

react-test:
    cd frontend && npm test

rust-test:
    cargo test --workspace

test: react-test rust-test

## ------------------------
## Build frontend functions
## ------------------------

# build the borrower's WASM wallet
build-wallet:
    wasm-pack build borrower-wallet --target web

# build frontend
force-build-frontend:
    cd frontend && npm run build --force

# rebuilds the frontend if a file in the frontend changes
watch-frontend:
    cd frontend && npm run watch


## ------------------------
## Build backend functions
## ------------------------

run-backend:
    cargo run --bin hub

# rebuilds the hub when related files change
watch-backend:
    cargo watch -i "justfile" \
                -C "hub" \
                -x "run"

## ------------------------
## Database helper functions
## ------------------------

db-prepare:
    cd hub && cargo sqlx prepare --workspace --database-url=$DB_URL

db-add-migration args="":
    sqlx migrate add --source ./hub/migrations -r {{args}}

db-run-migration:
    sqlx migrate run --source ./hub/migrations --database-url=$DB_URL

db-revert-migration:
    sqlx migrate revert --source ./hub/migrations --database-url=$DB_URL


## ------------------------
## Local dev setup help function
## ------------------------

watch-all:
    just watch-frontend & just watch-backend

## ------------------------
## Insert some test data into our database
## ------------------------

db-test-data:
    #!/usr/bin/env bash
    just db-run-migration
    set -euxo pipefail

    CONTAINER_NAME="postgres"
    DB_NAME="hub"
    DB_USER="hub"

    # Read SQL queries from the file
    SQL_FILE="./services/test_data/test_data.sql"
    SQL_QUERIES=$(cat "$SQL_FILE")

    # Execute SQL queries
    echo "$SQL_QUERIES" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"


    echo "Test data inserted successfully."
