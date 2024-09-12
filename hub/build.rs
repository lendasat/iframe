use std::fs;
use std::process::Command;

fn main() {
    // ensure that the directory exists which needs to be embedded in our binary
    let directory_path = "../frontend-monorepo/dist/apps/borrower";
    if fs::create_dir_all(directory_path).is_err() {
        std::process::exit(1);
    }
    // ensure that the directory exists which needs to be embedded in our binary
    let directory_path = "../frontend-monorepo/dist/apps/lender";
    if fs::create_dir_all(directory_path).is_err() {
        std::process::exit(1);
    }

    let output = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .output()
        .expect("to be able to get git commit hash");
    let git_hash = String::from_utf8(output.stdout).expect("to be able to parse commit hash");
    println!("cargo:rustc-env=GIT_HASH={}", git_hash);
}
