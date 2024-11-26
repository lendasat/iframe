ALTER TABLE moon_invoice_payments
    ADD CONSTRAINT moon_invoice_payments_invoice_id_fkey
        FOREIGN KEY (invoice_id) REFERENCES moon_invoices (id);
