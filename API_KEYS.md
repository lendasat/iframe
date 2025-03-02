# How to get an API key

To get started with an API key, follow these steps:

1. Sign up a new user
2. Provide user id to Lendasat employee who will generate a master API key, e.g. `las-BTC21` which will lead to the sha256 `8ca96224955a8a623c7efff84cfeb6d1693c6bc929b1657b9c0da932ac81a0ce`

```postgresql
insert into api_account_creator_api_keys (description, api_key_hash)
values ('example', '8ca96224955a8a623c7efff84cfeb6d1693c6bc929b1657b9c0da932ac81a0ce');
```

3. Now the user can create new sub users with. The function will return a new API key for this user

```bash
curl -X POST "http://localhost:7337/api/create-api-account" \
  -H "Content-Type: application/json" \
  -H "x-api-key: las-BTC21" \
  -d '{
    "name": "Satoshi Nakamoto",
    "email": "satoshi@gmx.com",
    "timezone": "America/New_York"
  }' \
  -v | jq .
```

e.g.

```json
{
  "id": "818316da-6cad-41d6-ac82-6a4d1ec91d3b",
  "name": "Satoshi Nakamoto",
  "email": "satoshi@gmx.com",
  "timezone": "America/New_York",
  "api_key": "ldst-acc-1d906625-064b-4c61-bb3a-41d497421e3f"
}
```

4. Who then can use this key e.g. send a loan request:

```bash
curl -X POST "http://localhost:7337/api/contracts" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ldst-acc-1d906625-064b-4c61-bb3a-41d497421e3f" \
  -v \
  -d '{
    "loan_id": "9c89f12b-3f1a-4320-bf68-be3ce0820dd2",
    "loan_amount": 100,
    "duration_days": 7,
    "borrower_btc_address": "tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37",
    "borrower_xpub": "tpubD6NzVbkrYhZ4Y8GthGPHWfMvNi3rs8F1ZDjyvmiB9qq4K1AsBDh2yaRznuHvuFNQEyXFFKxEYtUXTJB5cos9zJpjXU3sywyXVGTZMD8tzsh",
    "borrower_loan_address": "0x055098f73c89ca554f98c0298ce900235d2e1b4205a7ca629ae017518521c2c3",
    "loan_type": "StableCoin",
    "moon_card_id": null,
    "fiat_loan_details": null
  }' | jq .
```
