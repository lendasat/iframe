set dotenv-load := true

hub_logs := "$PWD/hub.log"
mempool_logs := "$PWD/mempool.log"

## ------------------------
## Install useful tools
## ------------------------

deps:
    cargo install cargo-watch
    cargo install sqlx-cli --no-default-features --features rustls,postgres
    cargo install wasm-pack

## ------------------------
## Code quality functions
## ------------------------

fmt:
    just fmt-dprint
    just fmt-frontend

fmt-dprint:
    dprint fmt

fmt-frontend:
    #!/usr/bin/env bash
    set -euxo pipefail
    cd frontend-monorepo
    pnpm biome format --write .

clippy:
    cargo clippy --all-targets --all-features -- -D warnings

lint-frontend:
    #!/usr/bin/env bash
    set -euxo pipefail
    cd frontend-monorepo
    pnpm biome lint

check-frontend:
    #!/usr/bin/env bash
    set -euxo pipefail
    cd frontend-monorepo
    pnpm check-types

## ------------------------
## Test functions
## ------------------------
# FIXME: we should run our frontend tests
# test-frontend:
#     #!/usr/bin/env bash
#     set -euxo pipefail
#     cd frontend-monorepo
#     pnpm test

test-rust:
    cargo test --workspace

# test: test-frontend test-rust
test: test-rust

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

    (exec -a mempool-mock just mempool &> {{ mempool_logs }}) &

    # TODO: We might need to wait longer here.

    echo "Mempool mock server started. Find the logs in {{ mempool_logs }}"

## ------------------------
## Serve frontend functions
## ------------------------

frontend-version:
    #!/usr/bin/env bash

    # Get the git commit hash
    GIT_COMMIT_HASH=$(git rev-parse HEAD)

    # Get the git tag (if available)
    GIT_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

    # Check if .env file exists
    if [ -f .env ]; then
        # For each variable, check if it exists and update it, or add it if it doesn't exist
        if grep -q "^VITE_APP_GIT_COMMIT_HASH=" .env; then
            # Update existing variable
            sed -i.bak "s/^VITE_APP_GIT_COMMIT_HASH=.*/VITE_APP_GIT_COMMIT_HASH=$GIT_COMMIT_HASH/" .env
            rm -f .env.bak
        else
            # Add new variable
            echo "VITE_APP_GIT_COMMIT_HASH=$GIT_COMMIT_HASH" >> .env
        fi

        if grep -q "^VITE_APP_GIT_TAG=" .env; then
            # Update existing variable
            sed -i.bak "s/^VITE_APP_GIT_TAG=.*/VITE_APP_GIT_TAG=$GIT_TAG/" .env
            rm -f .env.bak
        else
            # Add new variable
            echo "VITE_APP_GIT_TAG=$GIT_TAG" >> .env
        fi

    else
        # If .env doesn't exist, create it with our variables
        echo "VITE_APP_GIT_COMMIT_HASH=$GIT_COMMIT_HASH" > .env
        echo "VITE_APP_GIT_TAG=$GIT_TAG" >> .env
    fi

    echo "Environment variables updated:"
    echo "VITE_APP_GIT_COMMIT_HASH=$GIT_COMMIT_HASH"
    echo "VITE_APP_GIT_TAG=$GIT_TAG"

fronts: frontend-version
    #!/usr/bin/env bash
    cd frontend-monorepo
    pnpm dev

borrower: frontend-version
    #!/usr/bin/env bash
    cd frontend-monorepo
    pnpm --filter="@frontend/borrower" dev

lender: frontend-version
    #!/usr/bin/env bash
    cd frontend-monorepo
    pnpm --filter="@frontend/lender" dev

popup:
    #!/usr/bin/env bash
    cd frontend-monorepo
    pnpm --filter="@frontend/popup" dev

shop:
    #!/usr/bin/env bash
    cd frontend-monorepo
    pnpm --filter="@frontend/shop-demo" dev

## ------------------------
## Build frontend functions
## ------------------------

# install dependencies
deps-frontend:
    #!/usr/bin/env bash
    cd frontend-monorepo
    pnpm install

# build the WASM browser wallet
build-wallet:
    wasm-pack build browser-wallet --target web

# Build all or one of the frontend apps
build-frontend target='':
    #!/usr/bin/env bash
    cd frontend-monorepo
    if [ -n "{{ target }}" ]; then \
      pnpm build --filter @frontend/{{ target }}
    else \
      pnpm build
    fi

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

    just hub &> {{ hub_logs }} &

    # TODO: We might need to wait longer here.

    echo "Hub started. Find the logs in {{ hub_logs }}"

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
    sqlx migrate add --source ./hub/migrations -r {{ args }}

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
    [ ! -e "{{ hub_logs }}" ] || mv -f {{ hub_logs }} {{ hub_logs }}.old

# Wipe mock mempool server
wipe-mempool:
    pkill -9 mempool-mock && echo "Stopped mock mempool server" || echo "Mock mempool server not running, skipped"
    [ ! -e "{{ mempool_logs }}" ] || mv -f {{ mempool_logs }} {{ mempool_logs }}.old

wipe-frontend:
    find . -type d -name "node_modules" -o -name ".turbo" -o -name "dist" | xargs rm -rf
    echo go ahead and redo "just build-wallet deps-frontend"

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
