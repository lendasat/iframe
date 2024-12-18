use time::OffsetDateTime;

pub fn expiry_date(start_date: OffsetDateTime, duration_months: u64) -> OffsetDateTime {
    start_date + time::Duration::days(duration_months as i64 * 30)
}
