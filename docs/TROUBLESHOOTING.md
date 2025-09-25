# Troubleshooting Guide

## Development Environment Issues

### Turbo Daemon Connection Error

**Problem:**
When running `just watch-all`, you may encounter:
```
x Failed to connect to daemon.
`-> server is unavailable: channel closed
```

**Cause:**
This is typically due to Turbo's daemon having connectivity issues, particularly common in WSL environments.

**Solution:**
Start the services individually without relying on Turbo's orchestration:

```bash
# 1. Start the mempool mock service
just mempool-d

# 2. Start the hub backend (ensure NETWORK is set)
export NETWORK=regtest
just hub

# 3. Start frontend applications directly
cd frontend/apps/borrower && pnpm dev --port 4200 --host 0.0.0.0 &
cd frontend/apps/lender && pnpm dev --port 4201 --host 0.0.0.0 &
```

This bypasses Turbo entirely and runs the Vite dev servers directly.

## Build Issues

### MacOS WASM Compilation Errors

**Problem:**
On MacOS (M1 or Intel), you may encounter compilation errors when building the wallet for the borrower:

```
cargo:warning=error: unable to create target: 'No available targets are compatible with triple "wasm32-unknown-unknown"'
cargo:warning=1 error generated.
```

**Cause:**
The default clang compiler provided by Apple doesn't support the wasm32-unknown-unknown target.

**Solution:**
Install LLVM from Homebrew:

```bash
brew install llvm
```

Then add these environment variables to your `.env` file:

```dotenv
PATH="/opt/homebrew/opt/llvm/bin:$PATH"
LDFLAGS="-L/opt/homebrew/opt/llvm/lib"
CPPFLAGS="-I/opt/homebrew/opt/llvm/include"
```

## Database Issues

### SQLx Query Warnings

**Problem:**
When running `just db-prepare`, you may see:
```
warning: no queries found; please ensure that the `offline` feature is enabled in sqlx query data written to `sqlx-data.json` in the current directory; please check this into version control
```

**Solution:**
Update sqlx-cli:
```bash
cargo install sqlx-cli
```

### Test Data Already Exists

**Problem:**
Running `just db-test-data` fails with "API key already exists" error.

**Solution:**
This means the test data has already been loaded. The test users are:
- Bob the Lender: `bob_the_borrower@lendasat.com` / `password123`
- Alice the Borrower: `alice_the_lender@lendasat.com` / `123password`

No action needed unless you want to reset the database completely.

## Service Connection Issues

### Hub Cannot Connect to Mempool

**Problem:**
Hub fails to start with error:
```
Mempool actor stopped: error sending request for url (http://localhost:7339/api/blocks/tip/height): Connection refused
```

**Solution:**
Ensure the mempool mock service is running first:
```bash
just mempool-d
# Wait for "Starting to listen on 0.0.0.0:7339" message
# Then start the hub
just hub
```

### Missing Environment Variables

**Problem:**
Hub panics with "DB_URL must be set" or similar environment variable errors.

**Solution:**
1. Ensure you have copied `.env_sample` to `.env`
2. Configure all required variables in `.env`
3. For the hub, ensure `NETWORK=regtest` is set:
   ```bash
   export NETWORK=regtest
   just hub
   ```

## Frontend Issues

### Vite Network Binding in WSL

**Problem:**
Frontend apps start but aren't accessible from Windows browser when running in WSL.

**Solution:**
Use the `--host 0.0.0.0` flag when starting Vite:
```bash
pnpm dev --host 0.0.0.0
```

Or access via the WSL network IP shown in Vite output (e.g., `http://172.x.x.x:4200`)