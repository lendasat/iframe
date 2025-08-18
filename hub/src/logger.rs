use anyhow::Result;
use time::macros::format_description;
use tracing::metadata::LevelFilter;
use tracing::subscriber;
use tracing_log::LogTracer;
use tracing_subscriber::filter::Directive;
use tracing_subscriber::fmt::time::UtcTime;
use tracing_subscriber::EnvFilter;

const RUST_LOG_ENV: &str = "RUST_LOG";

pub fn init_tracing(level: LevelFilter, json_format: bool) -> Result<()> {
    if level == LevelFilter::OFF {
        return Ok(());
    }

    LogTracer::init_with_filter(tracing_log::log::LevelFilter::Info)?;

    let mut filter = EnvFilter::new("")
        .add_directive("sqlx::query=warn".parse()?)
        .add_directive("hyper_util=warn".parse()?)
        .add_directive("hyper=warn".parse()?)
        .add_directive("notification-ws=off".parse()?)
        // Used in our email client to render templates to text.
        .add_directive("handlebars=warn".parse()?)
        .add_directive(Directive::from(level));

    // Parse additional log directives from env variable
    let filter = match std::env::var_os(RUST_LOG_ENV).map(|s| s.into_string()) {
        Some(Ok(env)) => {
            for directive in env.split(',') {
                #[allow(clippy::print_stdout)]
                match directive.parse() {
                    Ok(d) => filter = filter.add_directive(d),
                    Err(e) => println!("WARN ignoring log directive: `{directive}`: {e}"),
                };
            }
            filter
        }
        _ => filter,
    };

    let is_terminal = atty::is(atty::Stream::Stderr);

    let sub = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(std::io::stderr)
        .with_ansi(is_terminal);

    if json_format {
        subscriber::set_global_default(sub.json().with_timer(UtcTime::rfc_3339()).finish())?;
    } else {
        subscriber::set_global_default(
            sub.with_timer(UtcTime::new(format_description!(
                "[year]-[month]-[day] [hour]:[minute]:[second]"
            )))
            .finish(),
        )?;
    };

    tracing::debug!("Initialized logger");

    Ok(())
}
