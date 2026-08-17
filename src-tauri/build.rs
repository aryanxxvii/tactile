use std::{env, fs, path::PathBuf};

fn main() {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is unavailable"));
    let version_file = manifest_dir.join("..").join("version.json");
    println!("cargo:rerun-if-changed={}", version_file.display());

    let contents = fs::read_to_string(&version_file).expect("failed to read version.json");
    let manifest: serde_json::Value =
        serde_json::from_str(&contents).expect("version.json is invalid JSON");
    let expected = manifest["version"]
        .as_str()
        .expect("version.json must contain a string version");
    let actual = env!("CARGO_PKG_VERSION");
    assert_eq!(
        actual, expected,
        "Cargo.toml version must match version.json; run npm run version:sync"
    );

    tauri_build::build()
}
