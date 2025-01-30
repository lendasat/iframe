use time::OffsetDateTime;

pub fn expiry_date(start_date: OffsetDateTime, duration_days: u64) -> OffsetDateTime {
    start_date + time::Duration::days(duration_days as i64)
}
