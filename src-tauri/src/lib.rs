const APPLICATION_TITLE_PREFIX: &str = "Tactile — ";
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::str::FromStr;
use tauri::http::{header::CONTENT_SECURITY_POLICY, Response as HttpResponse, StatusCode};
use tauri::{AppHandle, Manager};

pub mod assets;
pub mod portable;
pub mod storage;
mod updater;

#[derive(Debug, Deserialize)]
struct NativeWorkspaceFile {
    path: String,
    contents: String,
    encoding: Option<String>,
}

fn decode_data_url(value: &str) -> Result<Vec<u8>, String> {
    let (header, payload) = value
        .split_once(',')
        .ok_or_else(|| "invalid data URL".to_owned())?;
    if !header.starts_with("data:") {
        return Err("asset payload must be a data URL".to_owned());
    }
    if header.contains(";base64") {
        let mut output = Vec::with_capacity(payload.len() * 3 / 4);
        let mut buffer = 0u32;
        let mut bits = 0u8;
        for byte in payload.bytes() {
            if byte == b'=' || byte.is_ascii_whitespace() {
                continue;
            }
            let value = match byte {
                b'A'..=b'Z' => byte - b'A',
                b'a'..=b'z' => byte - b'a' + 26,
                b'0'..=b'9' => byte - b'0' + 52,
                b'+' => 62,
                b'/' => 63,
                _ => return Err("invalid base64 asset payload".to_owned()),
            } as u32;
            buffer = (buffer << 6) | value;
            bits += 6;
            if bits >= 8 {
                bits -= 8;
                output.push((buffer >> bits) as u8);
                if bits == 0 {
                    buffer = 0;
                } else {
                    buffer &= (1 << bits) - 1;
                }
            }
        }
        return Ok(output);
    }
    let mut output = Vec::with_capacity(payload.len());
    let bytes = payload.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let high = (bytes[index + 1] as char)
                .to_digit(16)
                .ok_or_else(|| "invalid percent-encoded asset payload".to_owned())?;
            let low = (bytes[index + 2] as char)
                .to_digit(16)
                .ok_or_else(|| "invalid percent-encoded asset payload".to_owned())?;
            output.push(((high << 4) | low) as u8);
            index += 3;
        } else {
            output.push(bytes[index]);
            index += 1;
        }
    }
    Ok(output)
}

fn atomic_write(path: &Path, contents: &[u8]) -> Result<(), String> {
    let temporary = path.with_extension(format!(
        "{}tmp",
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| format!("{extension}."))
            .unwrap_or_default()
    ));
    let mut file = std::fs::File::create(&temporary).map_err(|error| error.to_string())?;
    std::io::Write::write_all(&mut file, contents).map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;
    match std::fs::rename(&temporary, path) {
        Ok(()) => Ok(()),
        Err(_error) if path.exists() => {
            // Windows does not replace an existing destination with rename.
            // Keep the atomic path on Unix and use a safe replacement fallback.
            std::fs::remove_file(path).map_err(|remove_error| remove_error.to_string())?;
            std::fs::rename(&temporary, path).map_err(|rename_error| rename_error.to_string())
        }
        Err(error) => Err(error.to_string()),
    }
}

fn workspace_relative_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative);
    if path.as_os_str().is_empty() || path.is_absolute() {
        return Err("workspace file path must be relative".to_owned());
    }
    for component in path.components() {
        match component {
            Component::Normal(_) => {}
            _ => return Err(format!("unsafe workspace file path: {relative}")),
        }
    }
    Ok(root.join(path))
}

#[tauri::command]
fn workspace_choose_directory() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Choose a Tactile workspace folder")
        .pick_folder()
        .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
fn workspace_prepare_directory(path: String) -> Result<(), String> {
    let root = std::path::PathBuf::from(&path);
    std::fs::create_dir_all(root.join("objects")).map_err(|error| error.to_string())?;
    std::fs::create_dir_all(root.join("assets")).map_err(|error| error.to_string())?;
    std::fs::create_dir_all(root.join("themes")).map_err(|error| error.to_string())?;
    std::fs::create_dir_all(root.join(".tactile-runtime")).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn workspace_read_snapshot(path: String) -> Result<Option<String>, String> {
    let workspace_path = PathBuf::from(path).join("workspace.json");
    match std::fs::read_to_string(workspace_path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

const LAST_WORKSPACE_PATH_FILE: &str = "last-workspace-path.txt";

fn last_workspace_path_file(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join(LAST_WORKSPACE_PATH_FILE))
}

#[tauri::command]
fn workspace_get_last_path(app: AppHandle) -> Result<Option<String>, String> {
    let marker = last_workspace_path_file(&app)?;
    match std::fs::read_to_string(marker) {
        Ok(path) => {
            let path = path.trim().to_owned();
            if path.is_empty() {
                Ok(None)
            } else {
                Ok(Some(path))
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn workspace_set_last_path(app: AppHandle, path: String) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("workspace path cannot be empty".to_owned());
    }
    let marker = last_workspace_path_file(&app)?;
    atomic_write(&marker, path.as_bytes())
}

#[tauri::command]
fn workspace_open_directory(path: String) -> Result<(), String> {
    let root = PathBuf::from(path);
    if !root.is_dir() {
        return Err("the selected home directory no longer exists".to_owned());
    }

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = std::process::Command::new("explorer.exe");
        command.arg(&root);
        command
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = std::process::Command::new("open");
        command.arg(&root);
        command
    };
    #[cfg(target_os = "linux")]
    let mut command = {
        let mut command = std::process::Command::new("xdg-open");
        command.arg(&root);
        command
    };

    command
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn workspace_serve_html(app: AppHandle, content: String) -> Result<String, String> {
    use std::time::{SystemTime, UNIX_EPOCH};
    let sandbox_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?
        .join("html-sandbox");
    std::fs::create_dir_all(&sandbox_dir).map_err(|error| error.to_string())?;
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let file_name = format!("doc-{nanos}.html");
    let path = sandbox_dir.join(&file_name);
    atomic_write(&path, content.as_bytes())?;
    // The custom `tactile-html` protocol serves this file with its own
    // permissive CSP (set in `run`), which is exempt from the main window's
    // nonce'd script-src policy, so user-authored inline scripts run in the
    // native build. Tauri serves custom schemes at different URL forms per
    // platform: `scheme://localhost/...` on macOS/Linux, but
    // `http://scheme.localhost/...` on Windows/Android.
    #[cfg(target_os = "windows")]
    let url = format!("http://tactile-html.localhost/{file_name}");
    #[cfg(not(target_os = "windows"))]
    let url = format!("tactile-html://localhost/{file_name}");
    Ok(url)
}

/// Fetch a remote page through the backend and re-serve it over the local
/// `tactile-html` protocol, so the app can render it inside an ordinary
/// `<iframe>` without the remote site's `X-Frame-Options` /
/// `frame-ancestors` blocks applying. The page's own CSP meta tags are
/// removed (they would block the cross-origin assets the page loads from its
/// real origin) and a `<base>` element is injected so relative links and
/// resources resolve against the original address. Static and content sites
/// render fully; cookie-authenticated and API-driven apps remain limited
/// because the proxied page runs on the local protocol origin.
#[tauri::command]
async fn workspace_fetch_webview(app: tauri::AppHandle, url: String) -> Result<String, String> {
    use std::io::Read;
    use std::time::{SystemTime, UNIX_EPOCH};

    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("only http and https addresses may be embedded".to_owned());
    }

    let html = tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let agent = ureq::AgentBuilder::new()
            .timeout(std::time::Duration::from_secs(25))
            .build();
        let response = agent
            .get(&url)
            .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36")
            .set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .call()
            .map_err(|error| format!("failed to fetch {url}: {error}"))?;
        let final_url = response.get_url().to_string();
        let mut bytes: Vec<u8> = Vec::new();
        response
            .into_reader()
            .take(8 * 1024 * 1024)
            .read_to_end(&mut bytes)
            .map_err(|error| format!("failed to read response: {error}"))?;
        let body = String::from_utf8_lossy(&bytes).into_owned();
        Ok(rewrite_proxied_html(&body, &final_url))
    })
    .await
    .map_err(|error| error.to_string())??;

    let sandbox_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?
        .join("html-sandbox");
    std::fs::create_dir_all(&sandbox_dir).map_err(|error| error.to_string())?;
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let file_name = format!("link-{nanos}.html");
    atomic_write(&sandbox_dir.join(&file_name), html.as_bytes())?;
    #[cfg(target_os = "windows")]
    let served = format!("http://tactile-html.localhost/{file_name}");
    #[cfg(not(target_os = "windows"))]
    let served = format!("tactile-html://localhost/{file_name}");
    Ok(served)
}

/// Rewrite a fetched page so it renders from the local `tactile-html` origin:
/// drop CSP `<meta>` tags that would forbid the page's own cross-origin
/// resources, then inject a `<base>` so relative hrefs/srcs resolve against
/// the original address.
fn rewrite_proxied_html(body: &str, final_url: &str) -> String {
    let base_href = final_url.trim_end_matches('/');
    let mut rewritten = String::with_capacity(body.len() + 256);
    let mut rest = body;

    while let Some(start) = rest.find("<meta") {
        let end = match rest[start..].find('>') {
            Some(offset) => start + offset + 1,
            None => break,
        };
        let tag = &rest[start..end];
        if tag.to_ascii_lowercase().contains("content-security-policy") {
            rest = &rest[end..];
        } else {
            rewritten.push_str(&rest[..end]);
            rest = &rest[end..];
        }
    }
    rewritten.push_str(rest);

    let injected = format!("<base href=\"{base_href}/\">");
    if let Some(head) = rewritten.find("<head") {
        if let Some(close) = rewritten[head..].find('>') {
            let insert_at = head + close + 1;
            rewritten.insert_str(insert_at, &injected);
            return rewritten;
        }
    }
    rewritten.insert_str(0, &injected);
    rewritten
}

#[tauri::command]
fn workspace_open_url(url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("only http and https addresses may be opened".to_owned());
    }

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = std::process::Command::new("cmd");
        command.arg("/C").arg("start").arg("").arg(&url);
        command
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = std::process::Command::new("open");
        command.arg(&url);
        command
    };
    #[cfg(target_os = "linux")]
    let mut command = {
        let mut command = std::process::Command::new("xdg-open");
        command.arg(&url);
        command
    };

    command
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn workspace_write_snapshot(
    app: AppHandle,
    path: String,
    workspace_json: String,
    files: Vec<NativeWorkspaceFile>,
) -> Result<(), String> {
    let root = std::path::PathBuf::from(&path);
    std::fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    for file in files {
        let target = workspace_relative_path(&root, &file.path)?;
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let contents = if file.encoding.as_deref() == Some("data-url") {
            decode_data_url(&file.contents)?
        } else {
            file.contents.into_bytes()
        };
        atomic_write(&target, &contents)?;
    }
    atomic_write(&root.join("workspace.json"), workspace_json.as_bytes())?;
    workspace_set_last_path(app, path)?;
    Ok(())
}

const DEFAULT_WINDOW_TITLE: &str = "Tactile — Home";

fn native_window_title(document_title: &str) -> String {
    let compact_title = document_title
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if compact_title.is_empty() {
        DEFAULT_WINDOW_TITLE.to_owned()
    } else if compact_title.starts_with(APPLICATION_TITLE_PREFIX) {
        compact_title
    } else {
        format!("{APPLICATION_TITLE_PREFIX}{compact_title}")
    }
}

#[derive(Debug, Serialize)]
struct RunCodeResult {
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
    timed_out: bool,
    error: Option<String>,
}

fn run_process_with_timeout(command: &mut std::process::Command, timeout_ms: u64) -> RunCodeResult {
    use std::io::Read;
    let program = command.get_program().to_string_lossy().into_owned();
    let mut child = match command
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .stdin(std::process::Stdio::null())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            return RunCodeResult {
                exit_code: None,
                stdout: String::new(),
                stderr: String::new(),
                timed_out: false,
                error: Some(format!("unable to launch {program}: {error}")),
            };
        }
    };
    let mut stdout_reader = child.stdout.take();
    let mut stderr_reader = child.stderr.take();
    let stdout_handle = std::thread::spawn(move || {
        let mut buffer = String::new();
        if let Some(mut reader) = stdout_reader.take() {
            let _ = reader.read_to_string(&mut buffer);
        }
        buffer
    });
    let stderr_handle = std::thread::spawn(move || {
        let mut buffer = String::new();
        if let Some(mut reader) = stderr_reader.take() {
            let _ = reader.read_to_string(&mut buffer);
        }
        buffer
    });

    let started = std::time::Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                return RunCodeResult {
                    exit_code: status.code(),
                    stdout: stdout_handle.join().unwrap_or_default(),
                    stderr: stderr_handle.join().unwrap_or_default(),
                    timed_out: false,
                    error: None,
                };
            }
            Ok(None) => {
                if started.elapsed().as_millis() as u64 >= timeout_ms {
                    let _ = child.kill();
                    let _ = child.wait();
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(25));
            }
            Err(error) => {
                return RunCodeResult {
                    exit_code: None,
                    stdout: stdout_handle.join().unwrap_or_default(),
                    stderr: stderr_handle.join().unwrap_or_default(),
                    timed_out: false,
                    error: Some(error.to_string()),
                };
            }
        }
    }
    RunCodeResult {
        exit_code: None,
        stdout: stdout_handle.join().unwrap_or_default(),
        stderr: stderr_handle.join().unwrap_or_default(),
        timed_out: true,
        error: None,
    }
}

fn first_available(candidates: &[&str]) -> Option<String> {
    for candidate in candidates {
        if let Ok(output) = std::process::Command::new(candidate)
            .arg("--version")
            .stdin(std::process::Stdio::null())
            .output()
        {
            if output.status.success() {
                return Some(candidate.to_string());
            }
        }
    }
    None
}

fn write_source(dir: &Path, file_name: &str, source: &str) -> Result<PathBuf, String> {
    std::fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    let path = dir.join(file_name);
    std::fs::write(&path, source).map_err(|error| error.to_string())?;
    Ok(path)
}

fn configured_program(paths: &HashMap<String, String>, tool: &str, fallback: &str) -> String {
    paths
        .get(tool)
        .map(|path| path.trim())
        .filter(|path| !path.is_empty())
        .unwrap_or(fallback)
        .to_owned()
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CodeRuntimeInfo {
    tool: String,
    command: String,
    configured: bool,
    available: bool,
    version: String,
    error: Option<String>,
}

const PYTHON_RUNTIME_CANDIDATES: &[&str] = &["python3", "python", "py"];

fn probe_runtime_tool(
    tool: &str,
    candidates: &[String],
    executable_paths: &HashMap<String, String>,
) -> CodeRuntimeInfo {
    let configured = executable_paths
        .get(tool)
        .map(|path| path.trim())
        .filter(|path| !path.is_empty());
    let programs: Vec<String> = configured
        .map(|path| vec![path.to_owned()])
        .unwrap_or_else(|| candidates.to_vec());
    let mut last_error = None;
    for program in &programs {
        match std::process::Command::new(program)
            .arg("--version")
            .stdin(std::process::Stdio::null())
            .output()
        {
            Ok(output) if output.status.success() => {
                let text = if output.stdout.is_empty() {
                    &output.stderr
                } else {
                    &output.stdout
                };
                let version = String::from_utf8_lossy(text)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_owned();
                return CodeRuntimeInfo {
                    tool: tool.to_owned(),
                    command: program.clone(),
                    configured: configured.is_some(),
                    available: true,
                    version,
                    error: None,
                };
            }
            Ok(output) => last_error = Some(format!("version probe exited with {}", output.status)),
            Err(error) => last_error = Some(error.to_string()),
        }
    }
    CodeRuntimeInfo {
        tool: tool.to_owned(),
        command: programs.first().cloned().unwrap_or_default(),
        configured: configured.is_some(),
        available: false,
        version: String::new(),
        error: last_error,
    }
}

fn runtime_candidates(tool: &str) -> Vec<String> {
    let from = |names: &[&str]| names.iter().map(|name| name.to_string()).collect();
    match tool {
        "python" => from(PYTHON_RUNTIME_CANDIDATES),
        "node" => from(&["node"]),
        "gcc" => from(&["gcc"]),
        "gpp" => from(&["g++"]),
        "javac" => from(&["javac"]),
        "java" => from(&["java"]),
        "rustc" => from(&["rustc"]),
        "go" => from(&["go"]),
        "ruby" => from(&["ruby"]),
        "bash" => from(&["bash"]),
        other => vec![other.to_owned()],
    }
}

/// Probe a single runtime tool off the main thread. The plugin scans the
/// languages the user selected one tool at a time through this command, so a
/// slow `PATH` lookup for an uninstalled toolchain never freezes the UI.
#[tauri::command]
async fn workspace_probe_code_runtime(
    tool: String,
    executable_paths: Option<HashMap<String, String>>,
) -> CodeRuntimeInfo {
    let paths = executable_paths.unwrap_or_default();
    let candidates = runtime_candidates(&tool);
    let probe_tool = tool.clone();
    let fallback_command = candidates.first().cloned().unwrap_or_default();
    let task = tauri::async_runtime::spawn_blocking(move || {
        probe_runtime_tool(&probe_tool, &candidates, &paths)
    });
    task.await.unwrap_or_else(|error| CodeRuntimeInfo {
        tool,
        command: fallback_command,
        configured: false,
        available: false,
        version: String::new(),
        error: Some(format!("runtime probe task failed: {error}")),
    })
}

#[tauri::command]
async fn workspace_discover_code_runtimes(
    tools: Option<Vec<String>>,
    executable_paths: Option<HashMap<String, String>>,
) -> Vec<CodeRuntimeInfo> {
    let paths = executable_paths.unwrap_or_default();
    let wanted = tools.unwrap_or_else(|| vec!["python".to_owned(), "node".to_owned()]);
    let targets: Vec<(String, Vec<String>)> = wanted
        .iter()
        .map(|tool| (tool.clone(), runtime_candidates(tool)))
        .collect();
    let task = tauri::async_runtime::spawn_blocking(move || {
        targets
            .into_iter()
            .map(|(tool, candidates)| probe_runtime_tool(&tool, &candidates, &paths))
            .collect()
    });
    task.await.unwrap_or_default()
}

fn run_code_impl(
    language: &str,
    source: &str,
    timeout_ms: u64,
    executable_paths: &HashMap<String, String>,
) -> RunCodeResult {
    let dir = std::env::temp_dir().join(format!("tactile-code-run-{}", std::process::id()));
    let _ = std::fs::create_dir_all(&dir);
    let file_ext = match language {
        "javascript" | "jsx" | "typescript" | "tsx" => "js",
        "python" => "py",
        "c" => "c",
        "cpp" => "cpp",
        "java" => "java",
        "rust" => "rs",
        "go" => "go",
        "ruby" => "rb",
        "bash" => "sh",
        _ => {
            return RunCodeResult {
                exit_code: None,
                stdout: String::new(),
                stderr: String::new(),
                timed_out: false,
                error: Some(format!(
                    "running {language} internally is not supported yet"
                )),
            };
        }
    };
    let file_name = if language == "java" {
        "Main.java".to_owned()
    } else {
        format!("main.{file_ext}")
    };
    let file_path = match write_source(&dir, &file_name, source) {
        Ok(path) => path,
        Err(error) => {
            return RunCodeResult {
                exit_code: None,
                stdout: String::new(),
                stderr: String::new(),
                timed_out: false,
                error: Some(error),
            };
        }
    };
    let exe_name = if cfg!(windows) { "main.exe" } else { "main" };
    let exe = dir.join(exe_name);

    let compile_and_run =
        |compiler_args: Vec<String>, program_args: Vec<String>| -> RunCodeResult {
            let mut compile = std::process::Command::new(&compiler_args[0]);
            for argument in compiler_args.iter().skip(1) {
                compile.arg(argument);
            }
            let build = run_process_with_timeout(&mut compile, timeout_ms);
            if build.exit_code != Some(0) {
                return build;
            }
            let mut run = std::process::Command::new(&program_args[0]);
            for argument in program_args.iter().skip(1) {
                run.arg(argument);
            }
            run_process_with_timeout(&mut run, timeout_ms)
        };

    match language {
        "c" => compile_and_run(
            vec![
                configured_program(executable_paths, "gcc", "gcc"),
                file_path.to_string_lossy().into_owned(),
                "-o".into(),
                exe.to_string_lossy().into_owned(),
            ],
            vec![exe.to_string_lossy().into_owned()],
        ),
        "cpp" => compile_and_run(
            vec![
                configured_program(executable_paths, "gpp", "g++"),
                file_path.to_string_lossy().into_owned(),
                "-o".into(),
                exe.to_string_lossy().into_owned(),
            ],
            vec![exe.to_string_lossy().into_owned()],
        ),
        "rust" => compile_and_run(
            vec![
                configured_program(executable_paths, "rustc", "rustc"),
                file_path.to_string_lossy().into_owned(),
                "-o".into(),
                exe.to_string_lossy().into_owned(),
            ],
            vec![exe.to_string_lossy().into_owned()],
        ),
        "go" => {
            let mut run =
                std::process::Command::new(configured_program(executable_paths, "go", "go"));
            run.arg("run").arg(&file_path);
            run_process_with_timeout(&mut run, timeout_ms)
        }
        "java" => {
            let mut javac =
                std::process::Command::new(configured_program(executable_paths, "javac", "javac"));
            javac.current_dir(&dir).arg(&file_name);
            let build = run_process_with_timeout(&mut javac, timeout_ms);
            if build.exit_code != Some(0) {
                return build;
            }
            let mut java =
                std::process::Command::new(configured_program(executable_paths, "java", "java"));
            java.current_dir(&dir).arg("-cp").arg(".").arg("Main");
            run_process_with_timeout(&mut java, timeout_ms)
        }
        "python" => match executable_paths
            .get("python")
            .map(String::as_str)
            .filter(|path| !path.trim().is_empty())
            .map(str::to_owned)
            .or_else(|| first_available(PYTHON_RUNTIME_CANDIDATES))
        {
            Some(program) => {
                let mut run = std::process::Command::new(program);
                run.arg(&file_path);
                run_process_with_timeout(&mut run, timeout_ms)
            }
            None => RunCodeResult {
                exit_code: None,
                stdout: String::new(),
                stderr: String::new(),
                timed_out: false,
                error: Some("Python interpreter not found on this device".into()),
            },
        },
        "javascript" | "jsx" | "typescript" | "tsx" => match executable_paths
            .get("node")
            .map(String::as_str)
            .filter(|path| !path.trim().is_empty())
            .map(str::to_owned)
            .or_else(|| first_available(&["node"]))
        {
            Some(program) => {
                let mut run = std::process::Command::new(program);
                run.arg(&file_path);
                run_process_with_timeout(&mut run, timeout_ms)
            }
            None => RunCodeResult {
                exit_code: None,
                stdout: String::new(),
                stderr: String::new(),
                timed_out: false,
                error: Some("Node.js not found on this device".into()),
            },
        },
        "ruby" => match executable_paths
            .get("ruby")
            .map(String::as_str)
            .filter(|path| !path.trim().is_empty())
            .map(str::to_owned)
            .or_else(|| first_available(&["ruby"]))
        {
            Some(program) => {
                let mut run = std::process::Command::new(program);
                run.arg(&file_path);
                run_process_with_timeout(&mut run, timeout_ms)
            }
            None => RunCodeResult {
                exit_code: None,
                stdout: String::new(),
                stderr: String::new(),
                timed_out: false,
                error: Some("Ruby interpreter not found on this device".into()),
            },
        },
        "bash" => match executable_paths
            .get("bash")
            .map(String::as_str)
            .filter(|path| !path.trim().is_empty())
            .map(str::to_owned)
            .or_else(|| first_available(&["bash"]))
        {
            Some(program) => {
                let mut run = std::process::Command::new(program);
                run.arg(&file_path);
                run_process_with_timeout(&mut run, timeout_ms)
            }
            None => RunCodeResult {
                exit_code: None,
                stdout: String::new(),
                stderr: String::new(),
                timed_out: false,
                error: Some("bash not found on this device".into()),
            },
        },
        _ => RunCodeResult {
            exit_code: None,
            stdout: String::new(),
            stderr: String::new(),
            timed_out: false,
            error: Some(format!(
                "running {language} internally is not supported yet"
            )),
        },
    }
}

#[tauri::command]
fn workspace_run_code(
    language: String,
    source: String,
    timeout_ms: Option<u64>,
    executable_paths: Option<HashMap<String, String>>,
) -> RunCodeResult {
    run_code_impl(
        &language,
        &source,
        timeout_ms.unwrap_or(12_000),
        &executable_paths.unwrap_or_default(),
    )
}

#[derive(serde::Serialize)]
struct UpdateInfo {
    version: String,
    current_version: String,
    body: Option<String>,
    download_url: String,
    channel: updater::UpdateChannel,
}

#[tauri::command]
fn get_update_channel(app: tauri::AppHandle) -> Result<updater::UpdateChannel, String> {
    updater::load_channel(&app)
}

#[tauri::command]
fn set_update_channel(
    app: tauri::AppHandle,
    channel: String,
) -> Result<updater::UpdateChannel, String> {
    let channel = updater::UpdateChannel::from_str(&channel)?;
    updater::save_channel(&app, channel)?;
    Ok(channel)
}

#[tauri::command]
async fn check_for_update(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    let channel = updater::load_channel(&app)?;
    let updater = updater::build_updater(&app, channel)?;
    match updater.check().await {
        Ok(Some(update)) => Ok(Some(UpdateInfo {
            version: update.version,
            current_version: updater::canonical_version().to_string(),
            body: update.body,
            download_url: update.download_url.to_string(),
            channel,
        })),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

// Frameless-window commands backing the custom TitleBar (move, resize,
// minimize, maximize/restore, close). Resize uses the Window handle because
// start_resize_dragging only exists on tauri::Window, not WebviewWindow.
#[tauri::command]
fn window_minimize(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn window_toggle_maximize(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.is_maximized().map_err(|error| error.to_string())? {
        window.unmaximize().map_err(|error| error.to_string())?;
    } else {
        window.maximize().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn window_is_maximized(window: tauri::WebviewWindow) -> Result<bool, String> {
    window.is_maximized().map_err(|error| error.to_string())
}

#[tauri::command]
fn window_close(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|error| error.to_string())
}

#[tauri::command]
fn window_start_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|error| error.to_string())
}

#[tauri::command]
fn window_start_resize(app: tauri::AppHandle, direction: String) -> Result<(), String> {
    use tauri_runtime::ResizeDirection;
    let window = app
        .get_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let direction = match direction.as_str() {
        "north" => ResizeDirection::North,
        "south" => ResizeDirection::South,
        "east" => ResizeDirection::East,
        "west" => ResizeDirection::West,
        "northEast" => ResizeDirection::NorthEast,
        "northWest" => ResizeDirection::NorthWest,
        "southEast" => ResizeDirection::SouthEast,
        "southWest" => ResizeDirection::SouthWest,
        _ => return Err("invalid window resize direction".to_string()),
    };
    window
        .start_resize_dragging(direction)
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn download_and_install_update(app: tauri::AppHandle) -> Result<(), String> {
    let channel = updater::load_channel(&app)?;
    let updater = updater::build_updater(&app, channel)?;
    let update = updater.check().await.map_err(|e| e.to_string())?;
    if let Some(update) = update {
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
    }
    app.restart()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            workspace_choose_directory,
            workspace_prepare_directory,
            workspace_read_snapshot,
            workspace_get_last_path,
            workspace_set_last_path,
            workspace_open_directory,
            workspace_open_url,
            workspace_write_snapshot,
            workspace_serve_html,
            workspace_fetch_webview,
            workspace_discover_code_runtimes,
            workspace_probe_code_runtime,
            workspace_run_code,
            get_update_channel,
            set_update_channel,
            check_for_update,
            download_and_install_update,
            window_minimize,
            window_toggle_maximize,
            window_is_maximized,
            window_close,
            window_start_drag,
            window_start_resize,
        ])
        .register_uri_scheme_protocol("tactile-html", |_context, request| {
            // User-authored HTML objects are rendered through this custom protocol
            // so we can stamp our own permissive CSP on the response. Tauri's main
            // window CSP upgrades `unsafe-inline` to a per-response nonce, which would
            // block the user's inline <script> blocks; a custom scheme response with an
            // explicit script-src that allows inline scripts escapes that.
            let raw_path = request.uri().path().trim_start_matches('/').to_string();
            let file_name = raw_path.split('/').last().unwrap_or(&raw_path).to_string();
            let sandbox_root = _context
                .app_handle()
                .path()
                .app_config_dir()
                .map(|dir| dir.join("html-sandbox"))
                .unwrap_or_default();
            let path = sandbox_root.join(file_name);
            match std::fs::read(&path) {
                Ok(bytes) => HttpResponse::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", "text/html; charset=utf-8")
                    .header(
                        CONTENT_SECURITY_POLICY,
                        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; img-src * data: blob:; media-src * data: blob:; frame-src *;",
                    )
                    .body(bytes)
                    .unwrap_or_else(|_| HttpResponse::new("internal error".as_bytes().to_vec())),
                Err(_) => HttpResponse::builder()
                    .status(StatusCode::NOT_FOUND)
                    .header("Content-Type", "text/plain")
                    .body("not found".as_bytes().to_vec())
                    .unwrap_or_else(|_| HttpResponse::new(Vec::new())),
            }
        })
        .setup(|app| {
            let window_config = app
                .config()
                .app
                .windows
                .iter()
                .find(|window| window.label == "main")
                .ok_or_else(|| {
                    std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        "Tactile main window configuration is missing",
                    )
                })?;

            tauri::WebviewWindowBuilder::from_config(app.handle(), window_config)?
                .decorations(false)
                .on_document_title_changed(|window, title| {
                    if let Err(error) = window.set_title(&native_window_title(&title)) {
                        eprintln!("failed to update the Tactile window title: {error}");
                    }
                })
                .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tactile application");
}

#[cfg(test)]
mod tests {
    use super::{native_window_title, APPLICATION_TITLE_PREFIX, DEFAULT_WINDOW_TITLE};

    #[test]
    fn preserves_titles_already_owned_by_tactile() {
        assert_eq!(
            native_window_title("Tactile — Operating model"),
            "Tactile — Operating model"
        );
    }

    #[test]
    fn prefixes_unqualified_document_titles() {
        assert_eq!(
            native_window_title("Operating model"),
            "Tactile — Operating model"
        );
    }

    #[test]
    fn compacts_multiline_titles_and_uses_a_safe_default() {
        assert_eq!(
            native_window_title("  Tactile — Scenario\n matrix  "),
            "Tactile — Scenario matrix"
        );
        assert_eq!(native_window_title("\n\t"), DEFAULT_WINDOW_TITLE);
        assert!(DEFAULT_WINDOW_TITLE.starts_with(APPLICATION_TITLE_PREFIX));
    }
}
