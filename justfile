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

# rebuilds the frontend if a file in the frontend changes
watch-frontend:
    cd frontend && npm run watch

# rebuilds the boss if "any" file changes
watch-backend:
    cargo watch -x 'run --bin the-boss'

watch-all:
    just watch-frontend & just watch-backend

db-prepare:
    cargo sqlx prepare --workspace --database-url=$DB_URL

db-add-migration args="":
    sqlx migrate add -r {{args}}

db-run-migration:
    sqlx migrate run --database-url=$DB_URL

db-revert-migration args="":
    sqlx migrate revert --database-url=$DB_URL
