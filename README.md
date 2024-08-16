# Loan POC

## How to get started

We need `npm`, `just`, `rust` first.

For dev purposes we use [cargo-watch](https://crates.io/crates/cargo-watch).
use `just deps`, to install it.

### Dev run

Before you can run `the-boss`, you will need to make a copy of [./.env_sample](./.env_sample) and configure all variables.

Start `the-boss` and builds the frontend in one go and watch for file changes.

```bash
just watch-all
```

### DB changes

After you made some changes to the database or sqlx queries, make sure to run the command below. Make sure the database is running.

```bash
just db-prepare
```

### Postman: For local API development

For local API development we make use of [Postman](https://www.postman.com/downloads/).
A [postman.json](./Lendasat Postman Collection.postman_collection.json) file has been provided.

## Take loan protocol

```mermaid
sequenceDiagram
    participant L as Lender
    participant T as The Boss
    participant B as Borrower

    L->>T: I'm offering: $10k loan \nfor 1-3 months for 10%p.a.
    T->>B: forwards this info
    B->>T: cool - take_loan(\n\tprincipal_address, \n\trefund_address, \n\tmulti_sig_pk\n)
    T->>B: sweet -> funding_script + funding_address
    T->>L: deal is on -> funding_script \n\t+ funding_address\n\t+ principal_address
    B->>Bitcoin: Fund funding_address
    T->>Bitcoin: Verify funding
    T->>L: Funding done, release the principal
    L->>Chain2: send principal to principal_address
```

## Pay back loan protocol

```mermaid
sequenceDiagram
    participant B as Borrower
    participant T as The Boss
    participant L as Lender

    B->>Chain2: pay back principal \n\t+ interest to lender_address
    T->>Chain2: verifies
    T->>B: send half psbt to get back collateral
    B->>Bitcoin: send collateral to own address
```
