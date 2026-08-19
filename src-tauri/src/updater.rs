use semver::Version;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{Updater, UpdaterExt};

const UPDATE_CHANNEL_FILE: &str = "update-channel.txt";
const STABLE_ENDPOINT: &str =
    "https://github.com/aryanxxvii/tactile/releases/latest/download/latest.json";
const NIGHTLY_ENDPOINT: &str =
    "https://github.com/aryanxxvii/tactile/releases/download/nightly/latest.json";

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum UpdateChannel {
    Stable,
    Nightly,
}

impl UpdateChannel {
    pub fn endpoint(self) -> &'static str {
        match self {
            Self::Stable => STABLE_ENDPOINT,
            Self::Nightly => NIGHTLY_ENDPOINT,
        }
    }

    pub fn default_for(version: &Version) -> Self {
        if prerelease_channel(version).is_some() {
            Self::Nightly
        } else {
            Self::Stable
        }
    }

    pub fn accepts(self, current: &Version, candidate: &Version) -> bool {
        if candidate <= current {
            return false;
        }
        match self {
            Self::Stable => candidate.pre.is_empty(),
            Self::Nightly => prerelease_channel(candidate).is_some(),
        }
    }
}

impl FromStr for UpdateChannel {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim() {
            "stable" => Ok(Self::Stable),
            "nightly" => Ok(Self::Nightly),
            _ => Err("update channel must be stable or nightly".to_owned()),
        }
    }
}

pub fn canonical_version() -> Version {
    Version::parse(env!("CARGO_PKG_VERSION")).expect("Cargo package version must be valid SemVer")
}

fn prerelease_channel(version: &Version) -> Option<&str> {
    let channel = version.pre.as_str().split('.').next()?;
    matches!(channel, "alpha" | "rc").then_some(channel)
}

fn channel_file(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join(UPDATE_CHANNEL_FILE))
}

fn load_channel_file(path: &Path, default: UpdateChannel) -> Result<UpdateChannel, String> {
    match std::fs::read_to_string(path) {
        Ok(value) => Ok(UpdateChannel::from_str(&value).unwrap_or(default)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(default),
        Err(error) => Err(error.to_string()),
    }
}

pub fn load_channel(app: &AppHandle) -> Result<UpdateChannel, String> {
    load_channel_file(
        &channel_file(app)?,
        UpdateChannel::default_for(&canonical_version()),
    )
}

pub fn save_channel(app: &AppHandle, channel: UpdateChannel) -> Result<(), String> {
    super::atomic_write(&channel_file(app)?, channel.to_string().as_bytes())
}

pub fn build_updater(app: &AppHandle, channel: UpdateChannel) -> Result<Updater, String> {
    let endpoint = channel
        .endpoint()
        .parse()
        .map_err(|error| format!("invalid updater endpoint: {error}"))?;
    let current = canonical_version();
    app.updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|error| error.to_string())?
        .version_comparator(move |_package_version, release| {
            channel.accepts(&current, &release.version)
        })
        .build()
        .map_err(|error| error.to_string())
}

impl std::fmt::Display for UpdateChannel {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::Stable => "stable",
            Self::Nightly => "nightly",
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn version(value: &str) -> Version {
        Version::parse(value).unwrap()
    }

    #[test]
    fn defaults_prereleases_to_nightly_and_releases_to_stable() {
        assert_eq!(
            UpdateChannel::default_for(&version("1.2.0-alpha.1")),
            UpdateChannel::Nightly
        );
        assert_eq!(
            UpdateChannel::default_for(&version("1.2.0-rc.1")),
            UpdateChannel::Nightly
        );
        assert_eq!(
            UpdateChannel::default_for(&version("1.2.0")),
            UpdateChannel::Stable
        );
    }

    #[test]
    fn restricts_candidates_to_the_selected_channel_and_newer_versions() {
        let alpha = version("1.2.0-alpha.2");
        assert!(UpdateChannel::Nightly.accepts(&alpha, &version("1.2.0-alpha.3")));
        assert!(UpdateChannel::Nightly.accepts(&alpha, &version("1.2.0-rc.1")));
        assert!(!UpdateChannel::Nightly.accepts(&alpha, &version("1.2.0")));
        assert!(!UpdateChannel::Stable.accepts(&alpha, &version("1.2.0-rc.1")));
        assert!(UpdateChannel::Stable.accepts(&alpha, &version("1.2.0")));
        assert!(!UpdateChannel::Stable.accepts(&version("1.3.0-alpha.1"), &version("1.2.0")));
    }

    #[test]
    fn validates_persisted_channel_values() {
        assert_eq!(
            UpdateChannel::from_str("stable").unwrap(),
            UpdateChannel::Stable
        );
        assert_eq!(
            UpdateChannel::from_str("nightly\n").unwrap(),
            UpdateChannel::Nightly
        );
        assert!(UpdateChannel::from_str("custom").is_err());
    }
}
