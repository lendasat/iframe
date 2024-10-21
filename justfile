set dotenv-load

hub_logs := "$PWD/hub.log"
mempool_logs := "$PWD/mempool.log"

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
    npx nx run-many --target=lint --all --skipNxCache -- --max-warnings 0

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

prepare-e2e:
    # Start hub DB
    docker compose up -d

    just wait-for-db
    # Fill hub DB with test data
    just db-test-data
    # Start mempool mock server in the background
    just mempool-d
    # Start hub in the background
    just hub-d

wait-for-db:
    #!/usr/bin/env bash
    until docker exec postgres pg_isready -U hub; do
      echo "Waiting for PostgreSQL to be ready..."
      sleep 2
    done

    echo "PostgreSQL is ready!"

e2e:
    cargo test -p tests-e2e -- --ignored

# Start mock mempool server
mempool:
    cargo run -p mempool-mock

# Start mock mempool server in the background
mempool-d:
    #!/usr/bin/env bash
    set -euxo pipefail

    echo "Building mempool-mock first"
    cargo build --bin mempool-mock

    echo "Starting mock mempool server"

    (exec -a mempool-mock just mempool &> {{mempool_logs}}) &

    # TODO: We might need to wait longer here.

    echo "Mempool mock server started. Find the logs in {{mempool_logs}}"

## ------------------------
## Serve frontend functions
## ------------------------

borrower:
    #!/usr/bin/env bash
    cd frontend-monorepo
    npx nx serve borrower

lender:
    #!/usr/bin/env bash
    cd frontend-monorepo
    npx nx serve lender

## ------------------------
## Build frontend functions
## ------------------------

# install dependencies
deps-frontend:
    #!/usr/bin/env bash
    cd frontend-monorepo
    npm install

# build the WASM browser wallet
build-wallet:
    wasm-pack build browser-wallet --target web

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
## Build hub functions
## ------------------------

hub:
    cargo run --bin hub

# Start hub in the background
hub-d:
    #!/usr/bin/env bash
    set -euxo pipefail

    echo "Building hub first"
    cargo build --bin hub

    echo "Starting hub"

    just hub &> {{hub_logs}} &

    # TODO: We might need to wait longer here.

    echo "Hub started. Find the logs in {{hub_logs}}"

# rebuilds the hub when related files change
watch-hub:
    cargo watch -i "justfile" \
                -C "hub" \
                -x "run"

## ------------------------
## Database helper functions
## ------------------------

docker:
    docker compose up -d

db-prepare:
    cd hub && cargo sqlx prepare --workspace --database-url=$DB_URL

db-add-migration args="":
    sqlx migrate add --source ./hub/migrations -r {{args}}

db-run-migration:
    sqlx migrate run --source ./hub/migrations --database-url=$DB_URL

db-revert-migration:
    sqlx migrate revert --source ./hub/migrations --database-url=$DB_URL

## ------------------------
## Clean dev setup
## ------------------------

# Wipe all dev setup dependencies
wipe: wipe-docker wipe-hub wipe-mempool

# Wipe docker setup, including volumes
wipe-docker:
    docker compose down -v

# Wipe dev hub
wipe-hub:
    pkill -9 hub && echo "Stopped hub" || echo "Hub not running, skipped"
    [ ! -e "{{hub_logs}}" ] || mv -f {{hub_logs}} {{hub_logs}}.old

# Wipe mock mempool server
wipe-mempool:
    pkill -9 mempool-mock && echo "Stopped mock mempool server" || echo "Mock mempool server not running, skipped"
    [ ! -e "{{mempool_logs}}" ] || mv -f {{mempool_logs}} {{mempool_logs}}.old

## ------------------------
## Local dev setup help functions
## ------------------------

watch-all:
    just watch-frontend & just watch-hub

## ------------------------
## Insert some test data into our database
## ------------------------

db-test-data:
    cargo run --example test-data


## ------------------------
## Release functions
## ------------------------

release-wallet:
    wasm-pack build browser-wallet --target web --release

# just a convenience function
release-frontend:
    #!/usr/bin/env bash
    just build-frontend

release-hub:
    cargo build --bin hub --release
