use std::process::Command;

fn main() {
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

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs();

    println!("cargo:rustc-env=BUILD_TIMESTAMP={timestamp}");
}
