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
fn production_csp_has_no_remote_content_sources() {
    let config = config();
    let csp = config["app"]["security"]["csp"]
        .as_str()
        .expect("production CSP must be a string");

    assert!(csp.contains("default-src 'self'"));
    assert!(csp.contains("object-src 'none'"));
    assert!(csp.contains("frame-src 'self' asset: blob: data:"));
    assert!(csp.contains("script-src 'self'"));
    assert!(!csp.contains("http:"));
    assert!(!csp.contains("https:"));
    assert!(!csp.contains("ws:"));
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
fn main_capability_is_local_only_and_permissionless() {
    let capability = capability();

    assert_eq!(capability["windows"], serde_json::json!(["main"]));
    assert_eq!(capability["permissions"], serde_json::json!([]));
    assert!(capability.get("remote").is_none());
}
