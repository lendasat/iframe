

react-test:
    cd frontend && npm test

rust-test:
    cargo test --workspace

test: react-test rust-test

deps:
    cargo install cargo-watch

# rebuilds the frontend if a file in the frontend changes
watch-frontend:
    cd frontend && npm run watch

# rebuilds the boss if "any" file changes
watch-backend:
    cargo watch -x 'run --bin the-boss'

watch-all:
    just watch-frontend & just watch-backend

