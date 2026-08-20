use serde_json::Value;

const CONFIG: &str = include_str!("../tauri.conf.json");
const CAPABILITY: &str = include_str!("../capabilities/main.json");

fn config() -> Value {
    serde_json::from_str(CONFIG).expect("tauri.conf.json must remain valid JSON")
}

fn capability() -> Value {
    serde_json::from_str(CAPABILITY).expect("main capability must remain valid JSON")
}

#[test]
fn native_build_uses_the_existing_vite_client_output() {
    let config = config();
    let build = &config["build"];

    assert_eq!(build["devUrl"], "http://localhost:5173");
    assert_eq!(build["frontendDist"], "../dist/client");
    assert_eq!(build["beforeDevCommand"], "npm run dev -- --host 127.0.0.1");
    assert_eq!(build["beforeBuildCommand"], "npm run build");
}

#[test]
fn production_csp_limits_marketplace_delivery_to_github_raw() {
    let config = config();
    let csp = config["app"]["security"]["csp"]
        .as_str()
        .expect("production CSP must be a string");

    assert!(csp.contains("default-src 'self'"));
    assert!(csp.contains("object-src 'none'"));
    assert!(csp.contains("frame-src 'self' asset: tactile-html: blob: data: https: http:"));
    assert!(csp.contains("script-src 'self' 'unsafe-inline' blob:"));
    let connect_src = csp
        .split(';')
        .map(str::trim)
        .find(|directive| directive.starts_with("connect-src"))
        .expect("production CSP must define connect-src");
    assert_eq!(
        connect_src,
        "connect-src 'self' https://raw.githubusercontent.com https://github.com https://api.github.com"
    );
    assert!(csp.contains("img-src 'self'"));
    assert!(csp.contains("media-src 'self'"));
    assert!(!csp.contains("wss:"));
}

#[test]
fn development_csp_only_adds_loopback_vite_endpoints() {
    let config = config();
    let csp = config["app"]["security"]["devCsp"]
        .as_str()
        .expect("development CSP must be a string");

    assert!(csp.contains("http://localhost:5173"));
    assert!(csp.contains("ws://localhost:5173"));
    assert!(!csp.contains("https://"));
    assert!(!csp.contains("wss://"));
}

#[test]
fn main_capability_is_local_only_and_updater_only() {
    let capability = capability();

    assert_eq!(capability["windows"], serde_json::json!(["main"]));
    let permissions = capability["permissions"]
        .as_array()
        .expect("main capability must list permissions");
    assert!(
        permissions.contains(&serde_json::json!("updater:default")),
        "main capability must expose updater"
    );
    // The main window also exposes the internal devtools toggle for the
    // frameless titlebar; no other capabilities are expected.
    for permission in permissions {
        assert!(
            permission == "updater:default"
                || permission == "core:webview:allow-internal-toggle-devtools",
            "unexpected capability permission: {permission}"
        );
    }
    assert!(capability.get("remote").is_none());
}
