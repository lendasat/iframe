set dotenv-load

## ------------------------
## Install useful tools
## ------------------------

deps:
    cargo install cargo-watch
    cargo install sqlx-cli --no-default-features --features rustls,postgres

## ------------------------
## Code quality functions
## ------------------------

fmt:
    dprint fmt

clippy:
    cargo clippy --all-targets --all-features -- -D warnings

lint-frontend:
    #!/usr/bin/env bash
    set -euxo pipefail
    cd frontend-monorepo
    npx nx run-many --target=lint --all --skipNxCache



## ------------------------
## Test functions
## ------------------------

test-frontend:
    #!/usr/bin/env bash
    set -euxo pipefail
    cd frontend-monorepo
    npx nx run-many --target=test --all --skipNxCache

test-rust:
    cargo test --workspace

test: test-frontend test-rust

e2e-tests-frontend:
    #!/usr/bin/env bash
    set -euxo pipefail
    cd frontend-monorepo
    npx nx run-many --target=e2e --all --skipNxCache


## ------------------------
## Serve frontend functions
## ------------------------

run-borrower-frontend:
    #!/usr/bin/env bash
    cd frontend-monorepo
    npx nx serve borrower

run-lender-frontend:
    #!/usr/bin/env bash
    cd frontend-monorepo
    npx nx serve lender

## ------------------------
## Build frontend functions
## ------------------------

# build the borrower's WASM wallet
build-wallet:
    wasm-pack build borrower-wallet --target web

# build frontend
build-frontend:
    #!/usr/bin/env bash
    cd frontend-monorepo
    npx nx run-many --target=build --all --skipNxCache

# rebuilds the frontend if a file in the frontend changes
watch-frontend:
    #!/usr/bin/env bash
    cd frontend-monorepo
    npx nx watch --projects=borrower,lender -- npx nx run-many -t build -p borrower,lender

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
    cargo run --example  test-data
