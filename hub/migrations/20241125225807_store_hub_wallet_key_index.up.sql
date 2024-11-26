CREATE TABLE hub_wallet_index
(
    id         SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

insert into hub_wallet_index
values (1, CURRENT_TIMESTAMP);
