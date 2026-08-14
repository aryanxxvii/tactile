//! Native asset handles and streaming file storage.
//!
//! An asset handle is metadata plus a native path.  It deliberately has no
//! data URL or base64 field: the Tauri adapter can pass the handle to a file
//! viewer or stream it into an export without inflating the frontend state.

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use crate::portable::{
    OperationControl, PortableError, PortableErrorCode, PortableResult, ProgressEvent,
    ProgressPhase,
};

static ASSET_TEMP_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Debug)]
pub struct AssetStoreLimits {
    pub max_asset_bytes: u64,
}

impl Default for AssetStoreLimits {
    fn default() -> Self {
        Self {
            max_asset_bytes: crate::portable::DEFAULT_MAX_ASSET_BYTES,
        }
    }
}

#[derive(Clone, Debug)]
pub struct AssetWriteRequest {
    pub id: String,
    pub file_name: String,
    pub mime: Option<String>,
    pub expected_size: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AssetHandle {
    pub id: String,
    pub file_name: String,
    pub mime: Option<String>,
    pub size: u64,
    pub path: PathBuf,
}

pub struct AssetStore {
    root: PathBuf,
    limits: AssetStoreLimits,
}

impl AssetStore {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self {
            root: root.into(),
            limits: AssetStoreLimits::default(),
        }
    }

    pub fn with_limits(root: impl Into<PathBuf>, limits: AssetStoreLimits) -> Self {
        Self {
            root: root.into(),
            limits,
        }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn path_for(&self, id: &str, file_name: &str) -> PortableResult<PathBuf> {
        validate_component(id, "asset id")?;
        let safe_file_name = safe_file_name(file_name)?;
        Ok(self.root.join("assets").join(id).join(safe_file_name))
    }

    pub fn write_stream<R: Read>(
        &self,
        request: &AssetWriteRequest,
        mut reader: R,
        control: &mut OperationControl<'_>,
    ) -> PortableResult<AssetHandle> {
        control.check()?;
        if request.expected_size.unwrap_or(0) > self.limits.max_asset_bytes {
            return Err(PortableError::new(
                PortableErrorCode::OversizedAsset,
                "asset expected size exceeds the native asset limit",
            ));
        }
        let final_path = self.path_for(&request.id, &request.file_name)?;
        let parent = final_path
            .parent()
            .ok_or_else(|| PortableError::invalid_request("asset path has no parent directory"))?;
        fs::create_dir_all(parent).map_err(PortableError::from)?;
        let counter = ASSET_TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        let temporary_path = parent.join(format!(".asset-{counter}.part"));
        let mut temporary = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary_path)
            .map_err(PortableError::from)?;
        let result = (|| {
            let mut buffer = [0u8; 64 * 1024];
            let mut size = 0u64;
            loop {
                control.check()?;
                let read = reader.read(&mut buffer).map_err(PortableError::from)?;
                if read == 0 {
                    break;
                }
                size = size.checked_add(read as u64).ok_or_else(|| {
                    PortableError::new(PortableErrorCode::OversizedAsset, "asset size overflows")
                })?;
                if size > self.limits.max_asset_bytes {
                    return Err(PortableError::new(
                        PortableErrorCode::OversizedAsset,
                        "asset exceeds the native asset limit",
                    ));
                }
                temporary
                    .write_all(&buffer[..read])
                    .map_err(PortableError::from)?;
                control.report(ProgressEvent {
                    phase: ProgressPhase::Asset,
                    entries_completed: 0,
                    entries_total: 1,
                    bytes_completed: size,
                    bytes_total: request.expected_size.unwrap_or(0),
                })?;
            }
            if let Some(expected_size) = request.expected_size {
                if size != expected_size {
                    return Err(PortableError::new(
                        PortableErrorCode::MalformedAsset,
                        format!("asset size mismatch: expected {expected_size}, received {size}"),
                    ));
                }
            }
            temporary.sync_all().map_err(PortableError::from)?;
            drop(temporary);
            if final_path.exists() {
                fs::remove_file(&final_path).map_err(PortableError::from)?;
            }
            fs::rename(&temporary_path, &final_path).map_err(PortableError::from)?;
            Ok(AssetHandle {
                id: request.id.clone(),
                file_name: request.file_name.clone(),
                mime: request.mime.clone(),
                size,
                path: final_path.clone(),
            })
        })();
        if result.is_err() {
            let _ = fs::remove_file(&temporary_path);
            if fs::read_dir(parent)
                .map(|mut entries| entries.next().is_none())
                .unwrap_or(false)
            {
                let _ = fs::remove_dir(parent);
            }
        }
        result
    }

    pub fn open(&self, handle: &AssetHandle) -> PortableResult<File> {
        let expected_path = self.path_for(&handle.id, &handle.file_name)?;
        if expected_path != handle.path {
            return Err(PortableError::new(
                PortableErrorCode::InvalidPath,
                "asset handle path does not belong to this asset store",
            ));
        }
        File::open(expected_path).map_err(PortableError::from)
    }

    pub fn stream_to<W: Write>(
        &self,
        handle: &AssetHandle,
        mut writer: W,
        control: &mut OperationControl<'_>,
    ) -> PortableResult<u64> {
        let mut file = self.open(handle)?;
        file.seek(SeekFrom::Start(0)).map_err(PortableError::from)?;
        let mut buffer = [0u8; 64 * 1024];
        let mut copied = 0u64;
        loop {
            control.check()?;
            let read = file.read(&mut buffer).map_err(PortableError::from)?;
            if read == 0 {
                break;
            }
            writer
                .write_all(&buffer[..read])
                .map_err(PortableError::from)?;
            copied = copied.saturating_add(read as u64);
            control.report(ProgressEvent {
                phase: ProgressPhase::Asset,
                entries_completed: 1,
                entries_total: 1,
                bytes_completed: copied,
                bytes_total: handle.size,
            })?;
        }
        if copied != handle.size {
            return Err(PortableError::new(
                PortableErrorCode::MalformedAsset,
                "asset changed while it was being streamed",
            ));
        }
        Ok(copied)
    }
}

fn validate_component(value: &str, label: &str) -> PortableResult<()> {
    if value.is_empty()
        || value == "."
        || value == ".."
        || value.contains('/')
        || value.contains('\\')
        || value.contains(':')
        || value.chars().any(|character| character.is_control())
    {
        return Err(PortableError::new(
            PortableErrorCode::InvalidPath,
            format!("{label} is not a safe path component"),
        ));
    }
    Ok(())
}

fn safe_file_name(value: &str) -> PortableResult<String> {
    validate_component(value, "asset file name")?;
    Ok(value.to_owned())
}
