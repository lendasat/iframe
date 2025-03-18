use crate::db;
use crate::model::LoanDeal;
use anyhow::Result;
use sqlx::Pool;
use sqlx::Postgres;

#[derive(Debug, Clone, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "loan_deal_type", rename_all = "lowercase")]
pub enum LoanDealType {
    Offer,
    Application,
}

pub async fn get_loan_deal_by_id(pool: &Pool<Postgres>, loan_deal_id: &str) -> Result<LoanDeal> {
    // Tmp struct to hold the query result as we can't return the enum directly
    #[derive(sqlx::FromRow)]
    struct DealTypeRecord {
        #[allow(dead_code)]
        loan_deal_type: LoanDealType,
    }

    // First, determine the type of opportunity
    let loan_deal_type = sqlx::query_as!(
        DealTypeRecord,
        r#"
        SELECT type as "loan_deal_type: LoanDealType"
        FROM loan_deals
        WHERE id = $1
        "#,
        loan_deal_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| anyhow::anyhow!("Loan opportunity not found"))?;

    match loan_deal_type.loan_deal_type {
        LoanDealType::Offer => {
            let loan_offer = db::loan_offers::loan_by_id(pool, loan_deal_id)
                .await?
                .ok_or_else(|| anyhow::anyhow!("Loan offer not found for loan_deal_id"))?;

            Ok(LoanDeal::LoanOffer(loan_offer))
        }
        LoanDealType::Application => {
            let loan_application = db::loan_applications::get_loan_by_id(pool, loan_deal_id)
                .await?
                .ok_or_else(|| anyhow::anyhow!("Loan application not found for loan_deal_id"))?;

            Ok(LoanDeal::LoanApplication(loan_application))
        }
    }
}
