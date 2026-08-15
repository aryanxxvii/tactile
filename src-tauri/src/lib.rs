const APPLICATION_TITLE_PREFIX: &str = "Tactile — ";
use serde::Deserialize;
use std::path::{Component, Path, PathBuf};
use tauri::{AppHandle, Manager};

pub mod assets;
pub mod portable;
pub mod storage;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            workspace_choose_directory,
            workspace_prepare_directory,
            workspace_read_snapshot,
            workspace_get_last_path,
            workspace_set_last_path,
            workspace_open_directory,
            workspace_open_url,
            workspace_write_snapshot,
        ])
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
