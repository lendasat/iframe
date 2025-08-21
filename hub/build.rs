use std::fs;
use std::process::Command;

fn main() {
    // ensure that the directory exists which needs to be embedded in our binary
    let directory_path = "../frontend/dist/apps/borrower";
    if fs::create_dir_all(directory_path).is_err() {
        // In deployment scenarios, frontend might not be available
        // Create empty directory to satisfy the build
        eprintln!("Warning: Could not create borrower frontend directory, creating empty one");
        let _ = fs::create_dir_all(directory_path);
    }
    // ensure that the directory exists which needs to be embedded in our binary
    let directory_path = "../frontend/dist/apps/lender";
    if fs::create_dir_all(directory_path).is_err() {
        // In deployment scenarios, frontend might not be available
        // Create empty directory to satisfy the build
        eprintln!("Warning: Could not create lender frontend directory, creating empty one");
        let _ = fs::create_dir_all(directory_path);
    }

    let git_commit_hash = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .output()
        .map(|output| {
            if output.status.success() {
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            } else {
                "unknown".to_string()
            }
        })
        .unwrap_or_else(|_| "unknown".to_string());

    let git_tag = Command::new("git")
        .args(["describe", "--tags", "--abbrev=0"])
        .output()
        .map(|output| {
            if output.status.success() {
                Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                None
            }
        })
        .unwrap_or(None);

    println!("cargo:rustc-env=GIT_COMMIT_HASH={git_commit_hash}");

    println!(
        "cargo:rustc-env=GIT_TAG={}",
        git_tag.unwrap_or_else(|| "unknown".to_string())
    );
}
