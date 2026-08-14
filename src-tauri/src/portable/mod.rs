//! Native portable workspace boundaries.
//!
//! The browser format is intentionally file-oriented: JSON indexes describe
//! objects, sheets are CSV, Markdown remains Markdown, and native resources
//! remain native resources.  This module keeps that boundary independent from
//! React state and exposes streaming readers/writers for the Tauri adapter.

mod csv;
mod json;
mod zip;

pub use csv::{
    cell_address, coordinates_from_address, create_tactile_link, encode_csv_field, parse_csv,
    parse_tactile_link, stream_csv_cells, stringify_csv, CsvCell,
};
pub use json::{parse_json, stringify_json, write_json, JsonValue};
pub use zip::{crc32, ZipArchive, ZipCompression, ZipEntryInfo, ZipWriter};

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

pub const PORTABLE_FORMAT: &str = "tactile";
pub const CURRENT_PORTABLE_VERSION: u64 = 4;
pub const DEFAULT_MAX_OBJECTS: u64 = 10_000;
pub const DEFAULT_MAX_CELLS: u64 = 1_000_000;
pub const DEFAULT_MAX_ASSET_BYTES: u64 = 100 * 1024 * 1024;
pub const DEFAULT_MAX_TOTAL_ASSET_BYTES: u64 = 512 * 1024 * 1024;
pub const DEFAULT_MAX_ENTRY_BYTES: u64 = 512 * 1024 * 1024;
pub const DEFAULT_MAX_TOTAL_BYTES: u64 = 2 * 1024 * 1024 * 1024;
pub const DEFAULT_MAX_ENTRIES: u64 = 10_000;
pub const DEFAULT_MAX_PATH_BYTES: usize = 1024;

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(1);

pub type PortableResult<T> = Result<T, PortableError>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PortableErrorCode {
    Io,
    Cancelled,
    MalformedJson,
    MalformedFormat,
    MalformedVersion,
    UnsupportedVersion,
    UnsupportedPackageVersion,
    MalformedObjects,
    MalformedObject,
    MalformedCell,
    MalformedReference,
    MalformedAsset,
    MalformedPackage,
    MissingEntry,
    DuplicateEntry,
    DuplicateId,
    DanglingReference,
    OversizedWorkspace,
    OversizedAsset,
    ZipSignature,
    ZipUnsupported,
    ZipPathTraversal,
    ZipLimit,
    ZipCrcMismatch,
    DestinationExists,
    InvalidPath,
    InvalidRequest,
}

impl PortableErrorCode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Io => "IO_ERROR",
            Self::Cancelled => "CANCELLED",
            Self::MalformedJson => "MALFORMED_JSON",
            Self::MalformedFormat => "MALFORMED_FORMAT",
            Self::MalformedVersion => "MALFORMED_VERSION",
            Self::UnsupportedVersion => "UNSUPPORTED_VERSION",
            Self::UnsupportedPackageVersion => "UNSUPPORTED_PACKAGE_VERSION",
            Self::MalformedObjects => "MALFORMED_OBJECTS",
            Self::MalformedObject => "MALFORMED_OBJECT",
            Self::MalformedCell => "MALFORMED_CELL",
            Self::MalformedReference => "MALFORMED_REFERENCE",
            Self::MalformedAsset => "MALFORMED_ASSET",
            Self::MalformedPackage => "MALFORMED_PACKAGE",
            Self::MissingEntry => "MISSING_ENTRY",
            Self::DuplicateEntry => "DUPLICATE_ENTRY",
            Self::DuplicateId => "DUPLICATE_ID",
            Self::DanglingReference => "DANGLING_REFERENCE",
            Self::OversizedWorkspace => "OVERSIZED_WORKSPACE",
            Self::OversizedAsset => "OVERSIZED_ASSET",
            Self::ZipSignature => "ZIP_SIGNATURE",
            Self::ZipUnsupported => "ZIP_UNSUPPORTED",
            Self::ZipPathTraversal => "ZIP_PATH_TRAVERSAL",
            Self::ZipLimit => "ZIP_LIMIT",
            Self::ZipCrcMismatch => "ZIP_CRC_MISMATCH",
            Self::DestinationExists => "DESTINATION_EXISTS",
            Self::InvalidPath => "INVALID_PATH",
            Self::InvalidRequest => "INVALID_REQUEST",
        }
    }
}

#[derive(Debug)]
pub struct PortableError {
    code: PortableErrorCode,
    message: String,
}

impl PortableError {
    pub fn new(code: PortableErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn code(&self) -> &'static str {
        self.code.as_str()
    }

    pub fn code_kind(&self) -> PortableErrorCode {
        self.code
    }

    pub fn message(&self) -> &str {
        &self.message
    }

    pub fn malformed_json(message: impl Into<String>) -> Self {
        Self::new(PortableErrorCode::MalformedJson, message)
    }

    pub fn malformed_package(message: impl Into<String>) -> Self {
        Self::new(PortableErrorCode::MalformedPackage, message)
    }

    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self::new(PortableErrorCode::InvalidRequest, message)
    }
}

impl fmt::Display for PortableError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}: {}", self.code(), self.message)
    }
}

impl std::error::Error for PortableError {}

impl From<std::io::Error> for PortableError {
    fn from(error: std::io::Error) -> Self {
        Self::new(PortableErrorCode::Io, error.to_string())
    }
}

#[derive(Clone, Debug)]
pub struct PortableLimits {
    pub max_entries: u64,
    pub max_entry_compressed_bytes: u64,
    pub max_entry_uncompressed_bytes: u64,
    pub max_total_uncompressed_bytes: u64,
    pub max_objects: u64,
    pub max_cells: u64,
    pub max_asset_bytes: u64,
    pub max_total_asset_bytes: u64,
    pub max_path_bytes: usize,
    pub max_compression_ratio: u64,
}

impl Default for PortableLimits {
    fn default() -> Self {
        Self {
            max_entries: DEFAULT_MAX_ENTRIES,
            max_entry_compressed_bytes: DEFAULT_MAX_ENTRY_BYTES,
            max_entry_uncompressed_bytes: DEFAULT_MAX_ENTRY_BYTES,
            max_total_uncompressed_bytes: DEFAULT_MAX_TOTAL_BYTES,
            max_objects: DEFAULT_MAX_OBJECTS,
            max_cells: DEFAULT_MAX_CELLS,
            max_asset_bytes: DEFAULT_MAX_ASSET_BYTES,
            max_total_asset_bytes: DEFAULT_MAX_TOTAL_ASSET_BYTES,
            max_path_bytes: DEFAULT_MAX_PATH_BYTES,
            max_compression_ratio: 1_000,
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct CancellationToken {
    cancelled: Arc<AtomicBool>,
}

impl CancellationToken {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Release);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Acquire)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ProgressPhase {
    Validate,
    Read,
    Write,
    Extract,
    Asset,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProgressEvent {
    pub phase: ProgressPhase,
    pub entries_completed: u64,
    pub entries_total: u64,
    pub bytes_completed: u64,
    pub bytes_total: u64,
}

pub trait ProgressSink {
    fn on_progress(&mut self, event: ProgressEvent);
}

impl<F> ProgressSink for F
where
    F: FnMut(ProgressEvent),
{
    fn on_progress(&mut self, event: ProgressEvent) {
        self(event);
    }
}

pub struct OperationControl<'a> {
    pub cancellation: &'a CancellationToken,
    pub progress: Option<&'a mut dyn ProgressSink>,
}

impl<'a> OperationControl<'a> {
    pub fn new(cancellation: &'a CancellationToken) -> Self {
        Self {
            cancellation,
            progress: None,
        }
    }

    pub fn with_progress(
        cancellation: &'a CancellationToken,
        progress: &'a mut dyn ProgressSink,
    ) -> Self {
        Self {
            cancellation,
            progress: Some(progress),
        }
    }

    pub fn check(&self) -> PortableResult<()> {
        if self.cancellation.is_cancelled() {
            Err(PortableError::new(
                PortableErrorCode::Cancelled,
                "the portable operation was cancelled",
            ))
        } else {
            Ok(())
        }
    }

    pub fn report(&mut self, event: ProgressEvent) -> PortableResult<()> {
        self.check()?;
        if let Some(progress) = self.progress.as_deref_mut() {
            progress.on_progress(event);
        }
        self.check()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TactileLink {
    pub object_type: String,
    pub object_id: String,
    pub title: String,
}

pub fn safe_archive_path(path: &str, max_path_bytes: usize) -> PortableResult<String> {
    if path.is_empty() || path.len() > max_path_bytes || path.contains('\0') {
        return Err(PortableError::new(
            PortableErrorCode::InvalidPath,
            format!("archive path is empty or exceeds {max_path_bytes} bytes"),
        ));
    }
    if path.contains('\\') || path.starts_with('/') || path.starts_with(':') {
        return Err(PortableError::new(
            PortableErrorCode::ZipPathTraversal,
            format!("archive path is not a portable relative path: {path}"),
        ));
    }
    for component in path.split('/') {
        if component.is_empty() || component == "." || component == ".." || component.contains(':')
        {
            return Err(PortableError::new(
                PortableErrorCode::ZipPathTraversal,
                format!("archive path contains an unsafe component: {path}"),
            ));
        }
        if component.chars().any(|character| character.is_control()) {
            return Err(PortableError::new(
                PortableErrorCode::InvalidPath,
                format!("archive path contains a control character: {path}"),
            ));
        }
    }
    Ok(path.trim_end_matches('/').to_owned())
}

fn safe_output_path(root: &Path, archive_path: &str) -> PortableResult<PathBuf> {
    let mut output = root.to_path_buf();
    for component in archive_path.split('/') {
        output.push(component);
    }
    Ok(output)
}

fn temporary_directory_for(destination: &Path) -> PortableResult<PathBuf> {
    let parent = destination.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent).map_err(PortableError::from)?;
    let name = destination
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| {
            PortableError::invalid_request("import destination has no valid file name")
        })?;
    for _ in 0..100 {
        let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        let candidate = parent.join(format!(".{name}.tactile-import-{counter}"));
        match fs::create_dir(&candidate) {
            Ok(()) => return Ok(candidate),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.into()),
        }
    }
    Err(PortableError::new(
        PortableErrorCode::Io,
        "could not allocate a unique import staging directory",
    ))
}

fn finish_staging_directory(staging: &Path, destination: &Path) -> PortableResult<()> {
    if destination.exists() {
        return Err(PortableError::new(
            PortableErrorCode::DestinationExists,
            format!(
                "import destination already exists: {}",
                destination.display()
            ),
        ));
    }
    fs::rename(staging, destination).map_err(PortableError::from)
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PortableValidationReport {
    pub version: u64,
    pub object_count: u64,
    pub cell_count: u64,
    pub asset_count: u64,
    pub total_asset_bytes: u64,
}

#[derive(Clone, Debug)]
pub struct ValidationOptions {
    pub limits: PortableLimits,
    pub check_references: bool,
    pub check_assets: bool,
}

impl Default for ValidationOptions {
    fn default() -> Self {
        Self {
            limits: PortableLimits::default(),
            check_references: true,
            check_assets: true,
        }
    }
}

pub fn portable_version_of(value: &JsonValue) -> PortableResult<u64> {
    let raw = value
        .get("formatVersion")
        .or_else(|| value.get("version"))
        .ok_or_else(|| {
            PortableError::new(
                PortableErrorCode::MalformedVersion,
                "format version is missing",
            )
        })?;
    let version = raw.as_u64().ok_or_else(|| {
        PortableError::new(
            PortableErrorCode::MalformedVersion,
            "format version must be a positive integer",
        )
    })?;
    if version == 0 {
        return Err(PortableError::new(
            PortableErrorCode::MalformedVersion,
            "format version must be positive",
        ));
    }
    Ok(version)
}

fn assert_supported_version(value: &JsonValue) -> PortableResult<u64> {
    let version = portable_version_of(value)?;
    if version > CURRENT_PORTABLE_VERSION {
        return Err(PortableError::new(
            PortableErrorCode::UnsupportedVersion,
            format!(
                "portable format v{version} is newer than supported v{CURRENT_PORTABLE_VERSION}"
            ),
        ));
    }
    Ok(version)
}

fn collection<'a>(
    value: Option<&'a JsonValue>,
    label: &str,
) -> PortableResult<Vec<(String, &'a JsonValue)>> {
    let Some(value) = value else {
        return Ok(Vec::new());
    };
    match value {
        JsonValue::Object(values) => Ok(values
            .iter()
            .map(|(key, value)| (key.clone(), value))
            .collect()),
        JsonValue::Array(values) => values
            .iter()
            .enumerate()
            .map(|(index, value)| {
                if !matches!(value, JsonValue::Object(_)) {
                    return Err(PortableError::new(
                        PortableErrorCode::MalformedObjects,
                        format!("{label}[{index}] must be an object"),
                    ));
                }
                let key = value
                    .get("id")
                    .and_then(JsonValue::as_str)
                    .map(ToOwned::to_owned)
                    .unwrap_or_else(|| index.to_string());
                Ok((key, value))
            })
            .collect(),
        _ => Err(PortableError::new(
            PortableErrorCode::MalformedObjects,
            format!("{label} must be an object or array"),
        )),
    }
}

fn required_collection<'a>(
    value: Option<&'a JsonValue>,
    label: &str,
) -> PortableResult<Vec<(String, &'a JsonValue)>> {
    value
        .ok_or_else(|| {
            PortableError::new(
                PortableErrorCode::MalformedObjects,
                format!("{label} is missing"),
            )
        })
        .and_then(|value| collection(Some(value), label))
}

fn validate_id_set<'a>(
    records: &[(String, &'a JsonValue)],
    kind: &str,
) -> PortableResult<BTreeMap<String, &'a JsonValue>> {
    let mut by_id = BTreeMap::new();
    for (key, record) in records {
        if !matches!(record, JsonValue::Object(_)) {
            return Err(PortableError::new(
                PortableErrorCode::MalformedObject,
                format!("{kind} {key} must be an object"),
            ));
        }
        let id = record
            .get("id")
            .and_then(JsonValue::as_str)
            .filter(|value| !value.is_empty())
            .unwrap_or(key)
            .to_owned();
        if by_id.insert(id.clone(), *record).is_some() {
            return Err(PortableError::new(
                PortableErrorCode::DuplicateId,
                format!("{kind} id {id} appears more than once"),
            ));
        }
    }
    Ok(by_id)
}

fn declared_size(value: &JsonValue) -> PortableResult<Option<u64>> {
    let raw = value
        .get("size")
        .filter(|value| !value.is_null())
        .or_else(|| value.get("byteLength").filter(|value| !value.is_null()));
    let Some(raw) = raw else {
        return Ok(None);
    };
    raw.as_u64().map(Some).ok_or_else(|| {
        PortableError::new(
            PortableErrorCode::MalformedAsset,
            "asset size must be a non-negative integer",
        )
    })
}

fn validate_reference(
    reference: &str,
    object_ids: &BTreeMap<String, &JsonValue>,
    context: &str,
) -> PortableResult<()> {
    if !object_ids.contains_key(reference) {
        return Err(PortableError::new(
            PortableErrorCode::DanglingReference,
            format!("{context} references missing object {reference}"),
        ));
    }
    Ok(())
}

fn cell_reference(cell: &JsonValue) -> Option<String> {
    if let Some(embed) = cell.get("embed") {
        if let Some(object_id) = embed
            .as_str()
            .and_then(|value| parse_tactile_link(value).map(|link| link.object_id))
        {
            return Some(object_id);
        }
        if let Some(object_id) = embed.get("objectId").and_then(JsonValue::as_str) {
            return Some(object_id.to_owned());
        }
    }
    cell.get("value")
        .and_then(JsonValue::as_str)
        .and_then(|value| parse_tactile_link(value).map(|link| link.object_id))
}

pub fn validate_portable_workspace(
    workspace: &JsonValue,
    options: &ValidationOptions,
) -> PortableResult<PortableValidationReport> {
    let version = assert_supported_version(workspace)?;
    if let Some(format) = workspace.get("format") {
        if format.as_str() != Some(PORTABLE_FORMAT) {
            return Err(PortableError::new(
                PortableErrorCode::MalformedFormat,
                format!("expected a {PORTABLE_FORMAT} workspace"),
            ));
        }
    }
    let object_records = required_collection(workspace.get("objects"), "objects")?;
    if object_records.len() as u64 > options.limits.max_objects {
        return Err(PortableError::new(
            PortableErrorCode::OversizedWorkspace,
            "portable workspace contains too many objects",
        ));
    }
    let object_ids = validate_id_set(&object_records, "object")?;

    let home_id = workspace
        .get("homeObjectId")
        .or_else(|| workspace.get("rootObjectId"))
        .and_then(JsonValue::as_str);
    if let Some(home_id) = home_id {
        validate_reference(home_id, &object_ids, "home object")?;
    }

    let asset_records = collection(workspace.get("assets"), "assets")?;
    let assets = validate_id_set(&asset_records, "asset")?;
    let mut total_asset_bytes = 0u64;
    for (key, asset) in &assets {
        if let Some(size) = declared_size(asset)? {
            if size > options.limits.max_asset_bytes {
                return Err(PortableError::new(
                    PortableErrorCode::OversizedAsset,
                    format!("asset {key} exceeds the asset-size limit"),
                ));
            }
            total_asset_bytes = total_asset_bytes.checked_add(size).ok_or_else(|| {
                PortableError::new(
                    PortableErrorCode::OversizedWorkspace,
                    "asset size total overflow",
                )
            })?;
            if total_asset_bytes > options.limits.max_total_asset_bytes {
                return Err(PortableError::new(
                    PortableErrorCode::OversizedWorkspace,
                    "portable workspace exceeds its total asset-size limit",
                ));
            }
        }
    }

    let mut cell_count = 0u64;
    for (key, object) in &object_ids {
        let object_type = object
            .get("type")
            .and_then(JsonValue::as_str)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                PortableError::new(
                    PortableErrorCode::MalformedObject,
                    format!("object {key} is missing a type"),
                )
            })?;
        if let Some(parent) = object.get("parent") {
            if !parent.is_null() {
                if !matches!(parent, JsonValue::Object(_)) {
                    return Err(PortableError::new(
                        PortableErrorCode::MalformedReference,
                        format!("object {key} has an invalid parent record"),
                    ));
                }
                let parent_id = parent
                    .get("parentObjectId")
                    .and_then(JsonValue::as_str)
                    .ok_or_else(|| {
                        PortableError::new(
                            PortableErrorCode::MalformedReference,
                            format!("object {key} parent is missing parentObjectId"),
                        )
                    })?;
                validate_reference(parent_id, &object_ids, &format!("object {key} parent"))?;
                if let Some(link_id) = parent.get("linkId") {
                    if !matches!(link_id, JsonValue::String(_)) {
                        return Err(PortableError::new(
                            PortableErrorCode::MalformedReference,
                            format!("object {key} parent linkId must be a string"),
                        ));
                    }
                }
            }
        }
        if object_type != "sheet" {
            if options.check_assets {
                if let Some(asset_id) = object.get("assetId").and_then(JsonValue::as_str) {
                    if !assets.contains_key(asset_id) {
                        // v4 ZIP packages carry asset metadata on the object record,
                        // while JSON snapshots carry a top-level assets collection.
                        let has_inline_asset =
                            matches!(object.get("asset"), Some(JsonValue::Object(_)));
                        if !has_inline_asset {
                            return Err(PortableError::new(
                                PortableErrorCode::DanglingReference,
                                format!("object {key} references missing asset {asset_id}"),
                            ));
                        }
                    }
                }
            }
            if let Some(asset) = object.get("asset") {
                if !matches!(asset, JsonValue::Object(_)) {
                    return Err(PortableError::new(
                        PortableErrorCode::MalformedAsset,
                        format!("object {key} has invalid asset metadata"),
                    ));
                }
                if let Some(size) = declared_size(asset)? {
                    if size > options.limits.max_asset_bytes {
                        return Err(PortableError::new(
                            PortableErrorCode::OversizedAsset,
                            format!("asset on object {key} exceeds the asset-size limit"),
                        ));
                    }
                }
            }
            continue;
        }

        let cells = collection(object.get("cells"), &format!("objects.{key}.cells"))?;
        cell_count = cell_count.checked_add(cells.len() as u64).ok_or_else(|| {
            PortableError::new(PortableErrorCode::OversizedWorkspace, "cell count overflow")
        })?;
        if cell_count > options.limits.max_cells {
            return Err(PortableError::new(
                PortableErrorCode::OversizedWorkspace,
                "portable workspace contains too many cell records",
            ));
        }
        for (cell_key, cell) in cells {
            if !matches!(cell, JsonValue::Object(_)) {
                return Err(PortableError::new(
                    PortableErrorCode::MalformedCell,
                    format!("cell {cell_key} in object {key} must be an object"),
                ));
            }
            if !options.check_references {
                continue;
            }
            let Some(embed) = cell.get("embed") else {
                if let Some(reference) = cell_reference(cell) {
                    validate_reference(
                        &reference,
                        &object_ids,
                        &format!("cell {cell_key} in object {key}"),
                    )?;
                }
                continue;
            };
            if embed.is_null() {
                if let Some(reference) = cell_reference(cell) {
                    validate_reference(
                        &reference,
                        &object_ids,
                        &format!("cell {cell_key} in object {key}"),
                    )?;
                }
                continue;
            }
            if let Some(embed_string) = embed.as_str() {
                let link = parse_tactile_link(embed_string).ok_or_else(|| {
                    PortableError::new(
                        PortableErrorCode::MalformedReference,
                        format!("cell {cell_key} in object {key} has an invalid embed"),
                    )
                })?;
                validate_reference(
                    &link.object_id,
                    &object_ids,
                    &format!("cell {cell_key} in object {key}"),
                )?;
            } else if let Some(embed_object_id) = embed.get("objectId").and_then(JsonValue::as_str)
            {
                if let Some(link_id) = embed.get("linkId") {
                    if !matches!(link_id, JsonValue::String(_)) {
                        return Err(PortableError::new(
                            PortableErrorCode::MalformedReference,
                            format!("cell {cell_key} in object {key} has an invalid linkId"),
                        ));
                    }
                }
                if let Some(relation) = embed.get("relation").and_then(JsonValue::as_str) {
                    if relation != "containment" && relation != "alias" {
                        return Err(PortableError::new(
                            PortableErrorCode::MalformedReference,
                            format!("cell {cell_key} in object {key} has an invalid relation"),
                        ));
                    }
                }
                validate_reference(
                    embed_object_id,
                    &object_ids,
                    &format!("cell {cell_key} in object {key}"),
                )?;
            } else {
                return Err(PortableError::new(
                    PortableErrorCode::MalformedReference,
                    format!("cell {cell_key} in object {key} has an invalid embed"),
                ));
            }
        }
    }

    Ok(PortableValidationReport {
        version,
        object_count: object_records.len() as u64,
        cell_count,
        asset_count: assets.len() as u64,
        total_asset_bytes,
    })
}

#[derive(Clone, Debug)]
pub enum ExportSource {
    Bytes(Vec<u8>),
    File(PathBuf),
}

impl ExportSource {
    fn size(&self) -> PortableResult<u64> {
        match self {
            Self::Bytes(bytes) => Ok(bytes.len() as u64),
            Self::File(path) => Ok(fs::metadata(path).map_err(PortableError::from)?.len()),
        }
    }
}

#[derive(Clone, Debug)]
pub struct ExportEntry {
    pub path: String,
    pub source: ExportSource,
}

impl ExportEntry {
    pub fn bytes(path: impl Into<String>, bytes: impl Into<Vec<u8>>) -> Self {
        Self {
            path: path.into(),
            source: ExportSource::Bytes(bytes.into()),
        }
    }

    pub fn file(path: impl Into<String>, source: impl Into<PathBuf>) -> Self {
        Self {
            path: path.into(),
            source: ExportSource::File(source.into()),
        }
    }
}

#[derive(Clone, Debug)]
pub struct PortablePackage {
    pub manifest: JsonValue,
    pub workspace: JsonValue,
    pub resources: Vec<ExportEntry>,
}

impl PortablePackage {
    pub fn new(manifest: JsonValue, workspace: JsonValue) -> Self {
        Self {
            manifest,
            workspace,
            resources: Vec::new(),
        }
    }

    pub fn push_resource(&mut self, resource: ExportEntry) {
        self.resources.push(resource);
    }
}

pub fn export_portable<W: Write>(
    writer: W,
    package: &PortablePackage,
    limits: &PortableLimits,
    control: &mut OperationControl<'_>,
) -> PortableResult<ZipWriter<W>> {
    let manifest_version = assert_supported_version(&package.manifest).map_err(|error| {
        PortableError::new(
            PortableErrorCode::UnsupportedPackageVersion,
            error.to_string(),
        )
    })?;
    if manifest_version != CURRENT_PORTABLE_VERSION {
        return Err(PortableError::new(
            PortableErrorCode::UnsupportedPackageVersion,
            format!("portable package manifest must be v{CURRENT_PORTABLE_VERSION}"),
        ));
    }
    validate_portable_workspace(
        &package.workspace,
        &ValidationOptions {
            limits: limits.clone(),
            ..ValidationOptions::default()
        },
    )?;
    let format = package
        .manifest
        .get("format")
        .and_then(JsonValue::as_str)
        .unwrap_or(PORTABLE_FORMAT);
    if format != PORTABLE_FORMAT {
        return Err(PortableError::new(
            PortableErrorCode::MalformedFormat,
            format!("expected a {PORTABLE_FORMAT} package"),
        ));
    }

    let mut archive = ZipWriter::new(writer, limits.clone());
    let manifest_bytes = stringify_json(&package.manifest, true)?;
    let workspace_bytes = stringify_json(&package.workspace, true)?;
    archive.write_entry("manifest.json", &manifest_bytes, control)?;
    archive.write_entry("workspace.json", &workspace_bytes, control)?;

    let mut paths = BTreeSet::from([
        String::from("manifest.json"),
        String::from("workspace.json"),
    ]);
    for resource in &package.resources {
        control.check()?;
        let path = safe_archive_path(&resource.path, limits.max_path_bytes)?;
        if !paths.insert(path.clone()) {
            return Err(PortableError::new(
                PortableErrorCode::DuplicateEntry,
                format!("portable package contains duplicate path {path}"),
            ));
        }
        match &resource.source {
            ExportSource::Bytes(bytes) => archive.write_entry(&path, bytes, control)?,
            ExportSource::File(file_path) => {
                let mut file = File::open(file_path).map_err(PortableError::from)?;
                archive.write_entry_from_reader(
                    &path,
                    &mut file,
                    resource.source.size()?,
                    control,
                )?;
            }
        }
    }
    Ok(archive)
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ImportedPortableFile {
    pub archive_path: String,
    pub relative_path: PathBuf,
    pub size: u64,
    pub crc32: u32,
    pub is_directory: bool,
}

#[derive(Clone, Debug)]
pub struct SheetMetadataIndex {
    pub object_id: String,
    pub archive_path: String,
    pub raw: JsonValue,
    cells: BTreeMap<String, JsonValue>,
}

impl SheetMetadataIndex {
    pub fn cell(&self, address: &str) -> Option<&JsonValue> {
        let key = coordinates_from_address(address)
            .map(|(row, column)| cell_address(row, column))
            .unwrap_or_else(|| address.trim().to_ascii_uppercase());
        self.cells.get(&key)
    }

    pub fn cell_count(&self) -> usize {
        self.cells.len()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ImportedAsset {
    pub id: String,
    pub archive_path: String,
    pub relative_path: PathBuf,
    pub size: u64,
    pub mime: Option<String>,
    pub file_name: Option<String>,
}

#[derive(Clone, Debug)]
pub struct PortableImportResult {
    pub root: PathBuf,
    pub manifest: JsonValue,
    pub workspace: JsonValue,
    pub validation: PortableValidationReport,
    pub files: BTreeMap<String, ImportedPortableFile>,
    pub metadata: BTreeMap<String, SheetMetadataIndex>,
    pub assets: BTreeMap<String, ImportedAsset>,
}

impl PortableImportResult {
    pub fn file(&self, archive_path: &str) -> Option<&ImportedPortableFile> {
        self.files.get(archive_path)
    }

    pub fn file_path(&self, archive_path: &str) -> Option<PathBuf> {
        self.file(archive_path)
            .map(|file| self.root.join(&file.relative_path))
    }

    pub fn sheet_metadata(&self, object_id: &str) -> Option<&SheetMetadataIndex> {
        self.metadata.get(object_id)
    }

    pub fn asset(&self, asset_id: &str) -> Option<&ImportedAsset> {
        self.assets.get(asset_id)
    }

    pub fn resource_exports(&self) -> Vec<ExportEntry> {
        self.files
            .values()
            .filter(|file| {
                !file.is_directory
                    && file.archive_path != "manifest.json"
                    && file.archive_path != "workspace.json"
            })
            .map(|file| ExportEntry::file(&file.archive_path, self.root.join(&file.relative_path)))
            .collect()
    }
}

#[derive(Clone, Debug, Default)]
pub struct PortableImportOptions {
    pub limits: PortableLimits,
}

fn archive_file_path(
    value: &JsonValue,
    field: &str,
    limits: &PortableLimits,
) -> PortableResult<Option<String>> {
    let Some(raw) = value.get(field) else {
        return Ok(None);
    };
    if raw.is_null() {
        return Ok(None);
    }
    let path = raw.as_str().ok_or_else(|| {
        PortableError::new(
            PortableErrorCode::MalformedPackage,
            format!("{field} must be an archive path string"),
        )
    })?;
    Ok(Some(safe_archive_path(path, limits.max_path_bytes)?))
}

fn ensure_referenced_file<R: Read + Seek>(
    archive: &ZipArchive<R>,
    path: Option<&str>,
    context: &str,
) -> PortableResult<()> {
    let Some(path) = path else {
        return Ok(());
    };
    let Some(entry) = archive.entry(path) else {
        return Err(PortableError::new(
            PortableErrorCode::MissingEntry,
            format!("{context} references missing archive entry {path}"),
        ));
    };
    if entry.is_directory {
        return Err(PortableError::new(
            PortableErrorCode::MalformedPackage,
            format!("{context} references a directory instead of a file: {path}"),
        ));
    }
    Ok(())
}

fn metadata_index(
    object_id: &str,
    archive_path: &str,
    raw: JsonValue,
) -> PortableResult<SheetMetadataIndex> {
    let cells = match raw.get("cells") {
        None => BTreeMap::new(),
        Some(JsonValue::Object(values)) => {
            let mut cells = BTreeMap::new();
            for (address, value) in values {
                if !matches!(value, JsonValue::Object(_)) {
                    return Err(PortableError::new(
                        PortableErrorCode::MalformedCell,
                        format!("metadata cell {address} in {object_id} must be an object"),
                    ));
                }
                let key = coordinates_from_address(address)
                    .map(|(row, column)| cell_address(row, column))
                    .unwrap_or_else(|| address.trim().to_ascii_uppercase());
                if cells.insert(key.clone(), value.clone()).is_some() {
                    return Err(PortableError::new(
                        PortableErrorCode::MalformedPackage,
                        format!("metadata contains duplicate cell address {key}"),
                    ));
                }
            }
            cells
        }
        Some(_) => {
            return Err(PortableError::new(
                PortableErrorCode::MalformedPackage,
                format!("sheet metadata cells must be an object for {object_id}"),
            ));
        }
    };
    Ok(SheetMetadataIndex {
        object_id: object_id.to_owned(),
        archive_path: archive_path.to_owned(),
        raw,
        cells,
    })
}

fn add_asset_record(
    assets: &mut BTreeMap<String, (JsonValue, String)>,
    asset_id: &str,
    record: &JsonValue,
    path: &str,
) {
    assets
        .entry(asset_id.to_owned())
        .or_insert_with(|| (record.clone(), path.to_owned()));
}

fn validate_package_resources<R: Read + Seek>(
    archive: &ZipArchive<R>,
    workspace: &JsonValue,
    limits: &PortableLimits,
) -> PortableResult<BTreeMap<String, (JsonValue, String)>> {
    let object_records = required_collection(workspace.get("objects"), "objects")?;
    let mut assets = BTreeMap::new();
    for (key, record) in &object_records {
        let object_id = record
            .get("id")
            .and_then(JsonValue::as_str)
            .unwrap_or(key)
            .to_owned();
        let object_type = record.get("type").and_then(JsonValue::as_str).unwrap_or("");
        let file = archive_file_path(record, "file", limits)?;
        ensure_referenced_file(archive, file.as_deref(), &format!("object {object_id}"))?;
        if object_type == "sheet" {
            let metadata = archive_file_path(record, "metadata", limits)?;
            ensure_referenced_file(archive, metadata.as_deref(), &format!("object {object_id}"))?;
        }
        if object_type != "sheet" && object_type != "markdown" {
            if let Some(asset_id) = record.get("assetId").and_then(JsonValue::as_str) {
                let file = file.clone().ok_or_else(|| {
                    PortableError::new(
                        PortableErrorCode::MissingEntry,
                        format!("asset object {object_id} has no content file"),
                    )
                })?;
                add_asset_record(
                    &mut assets,
                    asset_id,
                    record.get("asset").unwrap_or(&JsonValue::Null),
                    &file,
                );
            }
        }
    }
    for (key, record) in collection(workspace.get("assets"), "assets")? {
        let asset_id = record
            .get("id")
            .and_then(JsonValue::as_str)
            .unwrap_or(&key)
            .to_owned();
        let path = match archive_file_path(record, "file", limits)? {
            Some(path) => path,
            None => archive_file_path(record, "path", limits)?.ok_or_else(|| {
                PortableError::new(
                    PortableErrorCode::MissingEntry,
                    format!("asset {asset_id} has no archive path"),
                )
            })?,
        };
        ensure_referenced_file(archive, Some(&path), &format!("asset {asset_id}"))?;
        add_asset_record(&mut assets, &asset_id, record, &path);
    }
    let mut total = 0u64;
    for (asset_id, (record, path)) in &assets {
        let entry = archive.entry(path).ok_or_else(|| {
            PortableError::new(
                PortableErrorCode::MissingEntry,
                format!("asset {asset_id} references missing archive entry {path}"),
            )
        })?;
        if entry.uncompressed_size > limits.max_asset_bytes {
            return Err(PortableError::new(
                PortableErrorCode::OversizedAsset,
                format!("asset {asset_id} exceeds the asset-size limit"),
            ));
        }
        if let Some(size) = declared_size(record)? {
            if size > limits.max_asset_bytes || size != entry.uncompressed_size {
                return Err(PortableError::new(
                    PortableErrorCode::MalformedAsset,
                    format!("asset {asset_id} metadata size does not match the archive resource"),
                ));
            }
        }
        total = total.checked_add(entry.uncompressed_size).ok_or_else(|| {
            PortableError::new(
                PortableErrorCode::OversizedWorkspace,
                "asset size total overflow",
            )
        })?;
        if total > limits.max_total_asset_bytes {
            return Err(PortableError::new(
                PortableErrorCode::OversizedWorkspace,
                "portable package exceeds its total asset-size limit",
            ));
        }
    }
    Ok(assets)
}

pub fn import_portable<R: Read + Seek>(
    mut reader: R,
    destination: impl AsRef<Path>,
    options: &PortableImportOptions,
    control: &mut OperationControl<'_>,
) -> PortableResult<PortableImportResult> {
    let destination = destination.as_ref();
    if destination.exists() {
        return Err(PortableError::new(
            PortableErrorCode::DestinationExists,
            format!(
                "import destination already exists: {}",
                destination.display()
            ),
        ));
    }

    let mut staging_path = None;
    let result = (|| {
        control.check()?;
        let mut archive = ZipArchive::open(&mut reader, options.limits.clone())?;
        let manifest = archive.read_json("manifest.json", control)?;
        if let Some(format) = manifest.get("format") {
            if format.as_str() != Some(PORTABLE_FORMAT) {
                return Err(PortableError::new(
                    PortableErrorCode::MalformedFormat,
                    "portable bundle manifest is not a Tactile package",
                ));
            }
        }
        let manifest_version = assert_supported_version(&manifest).map_err(|error| {
            PortableError::new(
                PortableErrorCode::UnsupportedPackageVersion,
                error.to_string(),
            )
        })?;
        if manifest_version != CURRENT_PORTABLE_VERSION {
            return Err(PortableError::new(
                PortableErrorCode::UnsupportedPackageVersion,
                format!("expected a v{CURRENT_PORTABLE_VERSION} portable manifest"),
            ));
        }
        let entry_path = archive_file_path(&manifest, "entry", &options.limits)?
            .unwrap_or_else(|| "workspace.json".to_owned());
        if entry_path != "workspace.json" {
            return Err(PortableError::new(
                PortableErrorCode::MalformedPackage,
                "native portable imports require workspace.json as the entry index",
            ));
        }
        let workspace = archive.read_json(&entry_path, control)?;
        let index_version = assert_supported_version(&workspace).map_err(|error| {
            PortableError::new(
                PortableErrorCode::UnsupportedPackageVersion,
                error.to_string(),
            )
        })?;
        if index_version != CURRENT_PORTABLE_VERSION {
            return Err(PortableError::new(
                PortableErrorCode::UnsupportedPackageVersion,
                format!("expected a v{CURRENT_PORTABLE_VERSION} workspace index"),
            ));
        }
        if let (Some(manifest_id), Some(index_id)) = (
            manifest.get("workspaceId").and_then(JsonValue::as_str),
            workspace.get("id").and_then(JsonValue::as_str),
        ) {
            if manifest_id != index_id {
                return Err(PortableError::new(
                    PortableErrorCode::MalformedPackage,
                    "manifest and workspace index ids do not match",
                ));
            }
        }
        let validation = validate_portable_workspace(
            &workspace,
            &ValidationOptions {
                limits: options.limits.clone(),
                check_assets: false,
                ..ValidationOptions::default()
            },
        )?;
        let asset_records = validate_package_resources(&archive, &workspace, &options.limits)?;

        let mut metadata = BTreeMap::new();
        for (key, record) in collection(workspace.get("objects"), "objects")? {
            if record.get("type").and_then(JsonValue::as_str) != Some("sheet") {
                continue;
            }
            let object_id = record
                .get("id")
                .and_then(JsonValue::as_str)
                .unwrap_or(&key)
                .to_owned();
            let Some(path) = archive_file_path(record, "metadata", &options.limits)? else {
                continue;
            };
            let raw = archive.read_json(&path, control)?;
            metadata.insert(object_id.clone(), metadata_index(&object_id, &path, raw)?);
        }

        let staging = temporary_directory_for(destination)?;
        staging_path = Some(staging.clone());
        let extraction = (|| {
            let mut files = BTreeMap::new();
            let entries = archive.entries().to_vec();
            let entries_total = entries.len() as u64;
            let bytes_total = archive.total_uncompressed_bytes();
            let mut bytes_completed = 0u64;
            for (index, entry) in entries.iter().enumerate() {
                control.check()?;
                let relative_path =
                    PathBuf::from(entry.path.replace('/', std::path::MAIN_SEPARATOR_STR));
                let output_path = safe_output_path(&staging, &entry.path)?;
                if entry.is_directory {
                    fs::create_dir_all(&output_path).map_err(PortableError::from)?;
                } else {
                    if let Some(parent) = output_path.parent() {
                        fs::create_dir_all(parent).map_err(PortableError::from)?;
                    }
                    let mut output = OpenOptions::new()
                        .write(true)
                        .create_new(true)
                        .open(&output_path)
                        .map_err(PortableError::from)?;
                    archive.extract_entry_to(index, &mut output, control)?;
                    output.sync_all().map_err(PortableError::from)?;
                }
                bytes_completed = bytes_completed.saturating_add(entry.uncompressed_size);
                files.insert(
                    entry.path.clone(),
                    ImportedPortableFile {
                        archive_path: entry.path.clone(),
                        relative_path,
                        size: entry.uncompressed_size,
                        crc32: entry.crc32,
                        is_directory: entry.is_directory,
                    },
                );
                control.report(ProgressEvent {
                    phase: ProgressPhase::Extract,
                    entries_completed: (index + 1) as u64,
                    entries_total,
                    bytes_completed,
                    bytes_total,
                })?;
            }
            Ok::<BTreeMap<String, ImportedPortableFile>, PortableError>(files)
        })();
        let files = match extraction {
            Ok(files) => files,
            Err(error) => return Err(error),
        };

        let mut assets = BTreeMap::new();
        for (asset_id, (record, path)) in asset_records {
            let Some(file) = files.get(&path) else {
                return Err(PortableError::new(
                    PortableErrorCode::MissingEntry,
                    format!("asset {asset_id} was not extracted"),
                ));
            };
            assets.insert(
                asset_id.clone(),
                ImportedAsset {
                    id: asset_id,
                    archive_path: path,
                    relative_path: file.relative_path.clone(),
                    size: file.size,
                    mime: record
                        .get("mime")
                        .and_then(JsonValue::as_str)
                        .map(ToOwned::to_owned),
                    file_name: record
                        .get("fileName")
                        .and_then(JsonValue::as_str)
                        .map(ToOwned::to_owned),
                },
            );
        }

        finish_staging_directory(&staging, destination)?;
        staging_path = None;
        Ok(PortableImportResult {
            root: destination.to_path_buf(),
            manifest,
            workspace,
            validation,
            files,
            metadata,
            assets,
        })
    })();

    if result.is_err() {
        if let Some(staging) = staging_path.take() {
            let _ = fs::remove_dir_all(staging);
        }
    }
    result
}
