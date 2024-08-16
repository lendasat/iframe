#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expires_in: String,
    pub jwt_maxage: i32,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_user: String,
    pub smtp_pass: String,
    pub smtp_from: String,
    pub smtp_disabled: bool,
    pub frontend_origin: String,
    pub listen_address: String,
}

impl Config {
    pub fn init() -> Config {
        let database_url = std::env::var("DB_URL").expect("DATABASE_URL must be set");
        let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");
        let jwt_expires_in = std::env::var("JWT_EXPIRED_IN").expect("JWT_EXPIRED_IN must be set");
        let jwt_maxage = std::env::var("JWT_MAXAGE").expect("JWT_MAXAGE must be set");

        let smtp_host = std::env::var("SMTP_HOST").ok();
        let smtp_port = std::env::var("SMTP_PORT").ok();
        let smtp_user = std::env::var("SMTP_USER").ok();
        let smtp_pass = std::env::var("SMTP_PASS").ok();
        let smtp_from = std::env::var("SMTP_FROM").ok();
        let smtp_disabled = std::env::var("SMTP_DISABLED").ok();

        let listen_address = std::env::var("LISTEN_ADDRESS").expect("LISTEN_ADDRESS must be set");
        let frontend_origin =
            std::env::var("FRONTEND_ORIGIN").expect("FRONTEND_ORIGIN must be set");

        let any_smtp_not_configured = smtp_host.is_none()
            || smtp_port.is_none()
            || smtp_user.is_none()
            || smtp_pass.is_none()
            || smtp_from.is_none();
        Config {
            database_url,
            jwt_secret,
            jwt_expires_in,
            jwt_maxage: jwt_maxage.parse::<i32>().unwrap(),
            smtp_host: smtp_host.unwrap_or_default(),
            smtp_pass: smtp_pass.unwrap_or_default(),
            smtp_user: smtp_user.unwrap_or_default(),
            smtp_port: smtp_port
                .map(|port| port.parse::<u16>().unwrap())
                .unwrap_or_default(),
            smtp_from: smtp_from.unwrap_or_default(),
            listen_address,
            frontend_origin,
            smtp_disabled: any_smtp_not_configured
                || smtp_disabled
                    .map(|disabled| disabled.parse::<bool>().unwrap())
                    .unwrap_or_default(),
        }
    }
}
