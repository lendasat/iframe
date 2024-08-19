set dotenv-load

fmt:
    dprint fmt

clippy:
    cargo clippy --all-targets --all-features -- -D warnings

react-test:
    cd frontend && npm test

rust-test:
    cargo test --workspace

test: react-test rust-test

deps:
    cargo install cargo-watch
    cargo install sqlx-cli --no-default-features --features rust-tls,postgres

# build the borrower's WASM wallet
build-wallet:
    wasm-pack build borrower-wallet --target web

# build frontend
force-build-frontend:
    cd frontend && npm run build --force

# rebuilds the frontend if a file in the frontend changes
watch-frontend:
    cd frontend && npm run watch

# rebuilds the hub when related files change
watch-backend:
    cargo watch -i "justfile" \
                -C "hub" \
                -x "run"

run-backend:
    cargo run --bin hub

watch-all:
    just watch-frontend & just watch-backend

db-prepare:
    cd hub && cargo sqlx prepare --workspace --database-url=$DB_URL

db-add-migration args="":
    sqlx migrate add --source ./hub/migrations -r {{args}}

db-run-migration:
    sqlx migrate run --source ./hub/migrations --database-url=$DB_URL

db-revert-migration:
    sqlx migrate revert --source ./hub/migrations --database-url=$DB_URL
