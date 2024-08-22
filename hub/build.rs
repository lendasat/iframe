use std::fs;

fn main() {
    // ensure that the directory exists which needs to be embedded in our binary
    let directory_path = "../frontend-monorepo/dist/apps/borrower-frontend";
    if fs::create_dir_all(directory_path).is_err() {
        std::process::exit(1);
    }
    // ensure that the directory exists which needs to be embedded in our binary
    let directory_path = "../frontend-monorepo/dist/apps/lender-frontend";
    if fs::create_dir_all(directory_path).is_err() {
        std::process::exit(1);
    }
}
