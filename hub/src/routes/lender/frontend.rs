use crate::routes::ErrorResponse;
use axum::body::Body;
use axum::extract::Path;
use axum::http::header;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::routing::get;
use axum::Json;
use axum::Router;
use include_dir::include_dir;
use include_dir::Dir;
use include_dir::File;
use mime_guess::mime;
use mime_guess::Mime;
use std::path::PathBuf;
use time::Duration;

const ROOT: &str = "";
const DEFAULT_FILES: [&str; 2] = ["index.html", "index.htm"];
const NOT_FOUND: &str = "404.html";

static FRONTEND_DIR: Dir<'_> =
    include_dir!("$CARGO_MANIFEST_DIR/../frontend-monorepo/dist/apps/lender");

async fn serve_asset(
    path: Option<Path<String>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let serve_file =
        |file: &File, mime_type: Option<Mime>, cache: Duration, code: Option<StatusCode>| {
            let response = Response::builder()
                .status(code.unwrap_or(StatusCode::OK))
                .header(
                    header::CONTENT_TYPE,
                    mime_type.unwrap_or(mime::TEXT_HTML).to_string(),
                )
                .header(
                    header::CACHE_CONTROL,
                    format!("max-age={}", cache.as_seconds_f32()),
                )
                .body(Body::from(file.contents().to_owned()))
                .map_err(|error| {
                    let error_response = ErrorResponse {
                        message: format!("Failed finding file: {}", error),
                    };
                    (StatusCode::NOT_FOUND, Json(error_response))
                })?;
            Ok(response)
        };

    let serve_not_found = || match FRONTEND_DIR.get_file(NOT_FOUND) {
        Some(file) => {
            let response = serve_file(file, None, Duration::ZERO, Some(StatusCode::NOT_FOUND))?;
            Ok(response)
        }
        None => {
            let error_response = ErrorResponse {
                message: "File Not Found".to_string(),
            };
            Err((StatusCode::NOT_FOUND, Json(error_response)))
        }
    };

    let serve_default = |path: &str| {
        for default_file in DEFAULT_FILES.iter() {
            let default_file_path = PathBuf::from(path).join(default_file);

            if FRONTEND_DIR.get_file(default_file_path.clone()).is_some() {
                let response = serve_file(
                    FRONTEND_DIR
                        .get_file(default_file_path)
                        .expect("to find file"),
                    None,
                    Duration::ZERO,
                    None,
                )?;
                return Ok(response);
            }
        }

        let response = serve_not_found()?;
        Ok(response)
    };

    match path {
        Some(Path(path)) => {
            if path == ROOT {
                return serve_default(&path);
            }

            FRONTEND_DIR.get_file(&path).map_or_else(
                || match FRONTEND_DIR.get_dir(&path) {
                    Some(_) => serve_default(&path),
                    None => serve_not_found(),
                },
                |file| {
                    let mime_type =
                        mime_guess::from_path(PathBuf::from(path.clone())).first_or_octet_stream();
                    let cache = if mime_type == mime::TEXT_HTML {
                        Duration::ZERO
                    } else {
                        Duration::days(365)
                    };

                    serve_file(file, Some(mime_type), cache, None)
                },
            )
        }
        None => serve_not_found(),
    }
}

pub(crate) fn router() -> Router {
    Router::new()
        .route(
            "/",
            get(|| async { serve_asset(Some(Path(String::from(ROOT)))).await }),
        )
        .route(
            "/*path",
            get(|path| async { serve_asset(Some(path)).await }),
        )
}
