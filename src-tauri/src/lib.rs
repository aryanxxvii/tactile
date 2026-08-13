const APPLICATION_TITLE_PREFIX: &str = "Tactile — ";
pub mod assets;
pub mod portable;
pub mod storage;

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
