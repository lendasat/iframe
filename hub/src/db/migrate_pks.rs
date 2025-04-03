use anyhow::Result;
use bitcoin::bip32;
use bitcoin::bip32::Xpub;
use bitcoin::key::Secp256k1;
use bitcoin::PublicKey;
use nostr::ToBech32;
use sqlx::Pool;
use sqlx::Postgres;
use std::str::FromStr;

pub const NOSTR_DERIVATION_PATH: &str = "m/44/0/0/0/0";

pub async fn migrate_pks(pool: &Pool<Postgres>) -> Result<()> {
    let mut tx = pool.begin().await?;

    let rows = sqlx::query!(
        r#"
        SELECT
            id,
            borrower_pk,
            borrower_xpub,
            borrower_derivation_path,
            lender_pk,
            lender_xpub,
            lender_derivation_path,
            contract_index,
            created_at
        FROM contracts"#,
    )
    .fetch_all(&mut *tx)
    .await?;

    let secp = Secp256k1::new();

    // This is the default borrower/lender PK we used when migrating away from Xpubs.
    let default_pk = "031b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f";

    for row in rows.iter() {
        if row.borrower_pk == default_pk {
            if let (Some(borrower_derivation_path), Some(borrower_xpub)) =
                (&row.borrower_derivation_path, &row.borrower_xpub)
            {
                let xpub = Xpub::from_str(borrower_xpub).expect("valid Xpub");
                let path =
                    bip32::DerivationPath::from_str(borrower_derivation_path).expect("valid path");

                let pk = xpub.derive_pub(&secp, &path)?;
                let pk = pk.public_key;
                let pk = PublicKey::new(pk);

                insert_borrower_pk_in_contract(&mut tx, &row.id, pk).await?;
            }
        }

        if let Some(borrower_xpub) = &row.borrower_xpub {
            let xpub = Xpub::from_str(borrower_xpub).expect("valid Xpub");

            let npub_path =
                bip32::DerivationPath::from_str(NOSTR_DERIVATION_PATH).expect("valid path");
            let npub = xpub.derive_pub(&secp, &npub_path)?;
            let npub = npub.public_key;
            let npub = nostr::PublicKey::from_byte_array(npub.x_only_public_key().0.serialize());
            insert_borrower_npub_in_contract(&mut tx, &row.id, npub.to_bech32()?).await?
        }

        if row.lender_pk == default_pk {
            if let Some(lender_xpub) = &row.lender_xpub {
                let xpub = Xpub::from_str(lender_xpub).expect("valid Xpub");
                let path = bip32::DerivationPath::from_str(&row.lender_derivation_path)
                    .expect("valid path");

                let pk = xpub.derive_pub(&secp, &path)?;
                let pk = pk.public_key;
                let pk = PublicKey::new(pk);

                let npub_path =
                    bip32::DerivationPath::from_str(NOSTR_DERIVATION_PATH).expect("valid path");
                let npub = xpub.derive_pub(&secp, &npub_path)?;
                let npub = npub.public_key;
                let npub =
                    nostr::PublicKey::from_byte_array(npub.x_only_public_key().0.serialize());

                insert_lender_pk_in_contract(&mut tx, &row.id, pk, npub.to_bech32()?).await?;
            }
        }
    }

    let rows = sqlx::query!(
        r#"
        SELECT
            id,
            lender_pk,
            lender_derivation_path,
            lender_xpub
        FROM loan_offers"#,
    )
    .fetch_all(&mut *tx)
    .await?;

    for row in rows.iter() {
        if row.lender_pk == default_pk {
            if let Some(lender_xpub) = &row.lender_xpub {
                let xpub = Xpub::from_str(lender_xpub).expect("valid Xpub");
                let path = bip32::DerivationPath::from_str(&row.lender_derivation_path)
                    .expect("valid path");

                let pk = xpub.derive_pub(&secp, &path)?;
                let pk = pk.public_key;
                let pk = PublicKey::new(pk);

                let npub_path =
                    bip32::DerivationPath::from_str(NOSTR_DERIVATION_PATH).expect("valid path");
                let npub = xpub.derive_pub(&secp, &npub_path)?;
                let npub = npub.public_key;
                let npub =
                    nostr::PublicKey::from_byte_array(npub.x_only_public_key().0.serialize());

                insert_lender_pk_in_offer(&mut tx, &row.id, pk, npub.to_bech32()?).await?;
            }
        }
    }

    tx.commit().await?;

    Ok(())
}

async fn insert_borrower_pk_in_contract(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    contract_id: &str,
    borrower_pk: PublicKey,
) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE contracts
        SET borrower_pk = $1
        WHERE id = $2
        "#,
        borrower_pk.to_string(),
        contract_id,
    )
    .execute(&mut **tx)
    .await?;

    Ok(())
}

async fn insert_borrower_npub_in_contract(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    contract_id: &str,
    borrower_npub: String,
) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE contracts
        SET 
            borrower_npub = $1
        WHERE id = $2
        "#,
        borrower_npub,
        contract_id,
    )
    .execute(&mut **tx)
    .await?;

    Ok(())
}

async fn insert_lender_pk_in_contract(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    contract_id: &str,
    lender_pk: PublicKey,
    lender_npub: String,
) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE contracts
        SET 
            lender_pk = $1,
            lender_npub = $2
        WHERE id = $3
        "#,
        lender_pk.to_string(),
        lender_npub,
        contract_id,
    )
    .execute(&mut **tx)
    .await?;

    Ok(())
}

async fn insert_lender_pk_in_offer(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    loan_offer_id: &str,
    lender_pk: PublicKey,
    lender_npub: String,
) -> Result<()> {
    sqlx::query!(
        r#"
        UPDATE loan_offers
        SET 
            lender_pk = $1,
            lender_npub = $2
        WHERE id = $3
        "#,
        lender_pk.to_string(),
        lender_npub,
        loan_offer_id,
    )
    .execute(&mut **tx)
    .await?;

    Ok(())
}
