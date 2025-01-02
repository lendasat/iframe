-- Ideally it would be NOT NULL, but it can't be due to backwards compatibility.
ALTER TABLE moon_invoices ADD COLUMN card_id CHAR(36);

ALTER TABLE moon_invoices
    ADD CONSTRAINT moon_invoices_card_id_fkey
        FOREIGN KEY (card_id) REFERENCES moon_cards(id);

-- Insert known `card_id`s for each invoice, where possible.
WITH c AS (
    SELECT moon_cards.id AS card_id, contracts.id AS contract_id
    FROM contracts
    INNER JOIN moon_cards ON moon_cards.contract_id = contracts.id
)
UPDATE moon_invoices
SET card_id = c.card_id
FROM c
WHERE c.contract_id = moon_invoices.contract_id;

-- A card can now be associated with more than one contract.
ALTER TABLE moon_cards DROP CONSTRAINT IF EXISTS moon_cards_contract_id_fkey;
ALTER TABLE moon_cards DROP COLUMN contract_id;
