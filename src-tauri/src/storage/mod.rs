//! Private native storage service for the E02 packet.
//!
//! E01 deliberately left the native manifest untouched, so this packet cannot
//! add `rusqlite` to `Cargo.toml` without crossing its write boundary.  This is
//! therefore a safe, dependency-free scaffold with the same durability
//! contract: record-oriented tables, an acknowledged append-only WAL, atomic
//! checkpoints, revision/transaction journal metadata, and portable-file
//! cache rebuilds.  The file format is private to this module and is designed
//! to be replaced behind this API by a rusqlite WAL backend when the owning
//! integration packet can change native dependencies.  Portable v4 data is
//! treated as opaque files and is never rewritten by the cache.
#![allow(dead_code)]

mod error;
mod records;

pub use error::{StorageError, StorageErrorCode, StorageResult};
pub use records::{RecordKey, RecordMutation, RecordTable, Transaction};

use std::collections::BTreeSet;
use std::convert::TryFrom;
use std::fmt;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};

const CURRENT_SCHEMA_VERSION: u32 = 2;
const CHECKPOINT_MAGIC: &[u8; 4] = b"TCK1";
const WAL_MAGIC: &[u8; 4] = b"TWL1";
const WAL_HEADER_BYTES: usize = 4 + 8 + 8;
const MAX_FRAME_BYTES: u64 = 64 * 1024 * 1024;
const MAX_RECORDS: u64 = 10_000_000;
const CHECKPOINT_FILE: &str = "checkpoint.bin";
const WAL_FILE: &str = "journal.wal";

/// Version of the private native cache format, not the portable v4 format.
pub const NATIVE_STORAGE_SCHEMA_VERSION: u32 = CURRENT_SCHEMA_VERSION;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CommitReceipt {
    pub transaction_id: u64,
    pub revision: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct JournalEntry {
    pub transaction_id: u64,
    pub revision: u64,
    pub mutation_count: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RebuildReport {
    pub file_count: usize,
    pub revision: u64,
}

#[derive(Clone, Debug)]
struct WalFrame {
    transaction_id: u64,
    revision: u64,
    schema_version: u32,
    mutations: Vec<RecordMutation>,
}

/// A durable record cache with a private WAL and checkpoint.
pub struct Storage {
    root: PathBuf,
    table: RecordTable,
    revision: u64,
    next_transaction_id: u64,
    schema_version: u32,
    journal: Vec<JournalEntry>,
}

impl fmt::Debug for Storage {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("Storage")
            .field("revision", &self.revision)
            .field("schema_version", &self.schema_version)
            .field("record_count", &self.table.len())
            .field("journal_count", &self.journal.len())
            .finish()
    }
}

impl Storage {
    /// Opens a cache and replays acknowledged WAL frames after its checkpoint.
    pub fn open(root: impl AsRef<Path>) -> StorageResult<Self> {
        Self::open_internal(root.as_ref(), CURRENT_SCHEMA_VERSION)
    }

    /// Opens a new cache at a known schema version for migration/bootstrap.
    /// Existing caches must be opened with [`Storage::open`].
    pub fn open_at_schema(root: impl AsRef<Path>, schema_version: u32) -> StorageResult<Self> {
        if schema_version == 0 || schema_version > CURRENT_SCHEMA_VERSION {
            return Err(StorageError::unsupported_schema("open-schema"));
        }
        Self::open_internal(root.as_ref(), schema_version)
    }

    fn open_internal(root: &Path, requested_schema: u32) -> StorageResult<Self> {
        fs::create_dir_all(root).map_err(|_| StorageError::io("open-cache"))?;

        let checkpoint_path = root.join(CHECKPOINT_FILE);
        let wal_path = root.join(WAL_FILE);
        let checkpoint_exists = checkpoint_path.exists();
        let wal_exists = wal_path.exists();

        let (mut table, mut revision, mut next_transaction_id, mut schema_version, mut journal) =
            if checkpoint_exists {
                decode_checkpoint(&read_file(&checkpoint_path, "read-checkpoint")?)?
            } else {
                (RecordTable::default(), 0, 0, requested_schema, Vec::new())
            };

        if schema_version == 0 || schema_version > CURRENT_SCHEMA_VERSION {
            return Err(StorageError::unsupported_schema("read-schema"));
        }

        if wal_exists {
            let mut wal = read_file(&wal_path, "read-journal")?;
            let valid_bytes = replay_wal(
                &wal,
                &mut table,
                &mut revision,
                &mut next_transaction_id,
                &mut schema_version,
                &mut journal,
                !checkpoint_exists,
            )?;
            if valid_bytes < wal.len() {
                wal.truncate(valid_bytes);
                write_file(&wal_path, &wal, "repair-journal")?;
            }
        }

        Ok(Self {
            root: root.to_owned(),
            table,
            revision,
            next_transaction_id,
            schema_version,
            journal,
        })
    }

    /// Opens a cache, rebuilding it from portable v4 files when the native
    /// cache has been deleted or has never been created.
    pub fn open_or_rebuild_from_portable_files(
        cache_root: impl AsRef<Path>,
        portable_root: impl AsRef<Path>,
    ) -> StorageResult<Self> {
        let cache_root = cache_root.as_ref();
        let cache_missing =
            !cache_root.join(CHECKPOINT_FILE).exists() && !cache_root.join(WAL_FILE).exists();
        let mut storage = Self::open(cache_root)?;
        if cache_missing || storage.is_empty() {
            storage.rebuild_cache_from_portable_files(portable_root)?;
        }
        Ok(storage)
    }

    pub fn schema_version(&self) -> u32 {
        self.schema_version
    }

    pub fn revision(&self) -> u64 {
        self.revision
    }

    pub fn is_empty(&self) -> bool {
        self.table.is_empty()
    }

    pub fn table(&self) -> &RecordTable {
        &self.table
    }

    pub fn journal(&self) -> &[JournalEntry] {
        &self.journal
    }

    pub fn begin_transaction(&self) -> Transaction {
        Transaction::default()
    }

    /// Appends and syncs one WAL frame before applying it in memory.  Return
    /// from this method is the acknowledgement boundary for an edit.
    pub fn commit(&mut self, transaction: Transaction) -> StorageResult<CommitReceipt> {
        self.commit_mutations(transaction.mutations(), self.schema_version)
    }

    fn commit_mutations(
        &mut self,
        mutations: &[RecordMutation],
        schema_version: u32,
    ) -> StorageResult<CommitReceipt> {
        validate_mutations(mutations)?;
        if mutations.is_empty() {
            return Err(StorageError::transaction_conflict("empty-transaction"));
        }
        if schema_version == 0 || schema_version > CURRENT_SCHEMA_VERSION {
            return Err(StorageError::unsupported_schema("commit-schema"));
        }

        let transaction_id = self
            .next_transaction_id
            .checked_add(1)
            .ok_or_else(|| StorageError::recovery_failed("transaction-sequence"))?;
        let revision = self
            .revision
            .checked_add(1)
            .ok_or_else(|| StorageError::recovery_failed("revision-sequence"))?;
        let frame = WalFrame {
            transaction_id,
            revision,
            schema_version,
            mutations: mutations.to_vec(),
        };
        append_wal(&self.root.join(WAL_FILE), &frame)?;

        for mutation in mutations {
            self.table.apply(mutation);
        }
        self.revision = revision;
        self.next_transaction_id = transaction_id;
        self.schema_version = schema_version;
        self.journal.push(JournalEntry {
            transaction_id,
            revision,
            mutation_count: mutations.len(),
        });

        Ok(CommitReceipt {
            transaction_id,
            revision,
        })
    }

    /// Runs one schema migration against a cloned table.  Nothing is written
    /// until the migration closure succeeds, so a failed migration leaves both
    /// the in-memory cache and durable checkpoint/WAL unchanged.
    pub fn migrate_to<F>(&mut self, target_schema: u32, migration: F) -> StorageResult<()>
    where
        F: FnOnce(&mut RecordTable) -> StorageResult<()>,
    {
        if target_schema <= self.schema_version || target_schema > CURRENT_SCHEMA_VERSION {
            return Err(StorageError::unsupported_schema("migrate-target"));
        }

        let original = self.table.clone();
        let mut candidate = original.clone();
        migration(&mut candidate).map_err(|_| StorageError::migration_failed("migration"))?;
        let mutations = diff_tables(&original, &candidate);

        if mutations.is_empty() {
            self.schema_version = target_schema;
            self.checkpoint()?;
            return Ok(());
        }

        self.commit_mutations(&mutations, target_schema)?;
        Ok(())
    }

    /// Writes a complete checkpoint atomically, then truncates the WAL.  A
    /// crash before truncation is safe because replay skips revisions already
    /// covered by the checkpoint.
    pub fn checkpoint(&mut self) -> StorageResult<()> {
        let bytes = encode_checkpoint(
            self.schema_version,
            self.revision,
            self.next_transaction_id,
            &self.table,
            &self.journal,
        )?;
        let checkpoint_path = self.root.join(CHECKPOINT_FILE);
        atomic_replace(&checkpoint_path, &bytes)?;

        let wal_path = self.root.join(WAL_FILE);
        let wal = File::create(&wal_path).map_err(|_| StorageError::io("truncate-journal"))?;
        wal.sync_all()
            .map_err(|_| StorageError::io("sync-journal"))?;
        sync_directory(&self.root);
        Ok(())
    }

    /// Replaces the cache with one opaque record per portable file.  The input
    /// must contain a v4 `workspace.json`; all other files, including native
    /// assets, are copied as bytes and are not parsed or rewritten here.
    pub fn rebuild_cache_from_portable_files(
        &mut self,
        portable_root: impl AsRef<Path>,
    ) -> StorageResult<RebuildReport> {
        let files = collect_portable_files(portable_root.as_ref())?;
        let mut candidate = RecordTable::default();
        for (relative_path, bytes) in &files {
            let key = RecordKey::new("portable-file", relative_path.clone())?;
            candidate.insert_for_rebuild(key, bytes.clone())?;
        }

        let mutations = diff_tables(&self.table, &candidate);
        if !mutations.is_empty() {
            self.commit_mutations(&mutations, self.schema_version)?;
        }
        self.checkpoint()?;

        Ok(RebuildReport {
            file_count: files.len(),
            revision: self.revision,
        })
    }
}

fn validate_mutations(mutations: &[RecordMutation]) -> StorageResult<()> {
    let mut keys = BTreeSet::new();
    for mutation in mutations {
        if !keys.insert(mutation.key().clone()) {
            return Err(StorageError::transaction_conflict("duplicate-record"));
        }
    }
    Ok(())
}

fn diff_tables(before: &RecordTable, after: &RecordTable) -> Vec<RecordMutation> {
    let mut keys = BTreeSet::new();
    keys.extend(before.records.keys().cloned());
    keys.extend(after.records.keys().cloned());

    keys.into_iter()
        .filter_map(
            |key| match (before.records.get(&key), after.records.get(&key)) {
                (Some(old), Some(new)) if old == new => None,
                (_, Some(new)) => Some(RecordMutation {
                    key,
                    value: Some(new.clone()),
                }),
                (Some(_), None) => Some(RecordMutation { key, value: None }),
                (None, None) => None,
            },
        )
        .collect()
}

fn read_file(path: &Path, operation: &'static str) -> StorageResult<Vec<u8>> {
    let mut file = File::open(path).map_err(|_| StorageError::io(operation))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|_| StorageError::io(operation))?;
    Ok(bytes)
}

fn write_file(path: &Path, bytes: &[u8], operation: &'static str) -> StorageResult<()> {
    let mut file = File::create(path).map_err(|_| StorageError::io(operation))?;
    file.write_all(bytes)
        .map_err(|_| StorageError::io(operation))?;
    file.sync_all().map_err(|_| StorageError::io(operation))?;
    Ok(())
}

fn append_wal(path: &Path, frame: &WalFrame) -> StorageResult<()> {
    let payload = encode_wal_payload(frame)?;
    let payload_len =
        u64::try_from(payload.len()).map_err(|_| StorageError::invalid_format("journal-size"))?;
    if payload_len > MAX_FRAME_BYTES {
        return Err(StorageError::invalid_format("journal-size"));
    }

    let mut bytes = Vec::with_capacity(WAL_HEADER_BYTES.saturating_add(payload.len()));
    bytes.extend_from_slice(WAL_MAGIC);
    bytes.extend_from_slice(&payload_len.to_le_bytes());
    bytes.extend_from_slice(&checksum(&payload).to_le_bytes());
    bytes.extend_from_slice(&payload);

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|_| StorageError::io("append-journal"))?;
    file.write_all(&bytes)
        .map_err(|_| StorageError::io("append-journal"))?;
    file.sync_all()
        .map_err(|_| StorageError::io("acknowledge-journal"))?;
    Ok(())
}

fn replay_wal(
    bytes: &[u8],
    table: &mut RecordTable,
    revision: &mut u64,
    next_transaction_id: &mut u64,
    schema_version: &mut u32,
    journal: &mut Vec<JournalEntry>,
    allow_initial_schema: bool,
) -> StorageResult<usize> {
    let mut offset = 0usize;
    while offset < bytes.len() {
        let remaining = bytes.len().saturating_sub(offset);
        if remaining < WAL_HEADER_BYTES {
            return Ok(offset);
        }
        if &bytes[offset..offset + 4] != WAL_MAGIC {
            return Err(StorageError::corrupt_journal("journal-magic"));
        }
        let payload_len = read_u64(&bytes[offset + 4..offset + 12])?;
        if payload_len > MAX_FRAME_BYTES {
            return Err(StorageError::corrupt_journal("journal-size"));
        }
        let frame_len = WAL_HEADER_BYTES
            .checked_add(
                usize::try_from(payload_len)
                    .map_err(|_| StorageError::corrupt_journal("journal-size"))?,
            )
            .ok_or_else(|| StorageError::corrupt_journal("journal-size"))?;
        if remaining < frame_len {
            return Ok(offset);
        }
        let expected_checksum = read_u64(&bytes[offset + 12..offset + 20])?;
        let payload_start = offset + WAL_HEADER_BYTES;
        let payload_end = payload_start + payload_len as usize;
        let payload = &bytes[payload_start..payload_end];
        if checksum(payload) != expected_checksum {
            if payload_end == bytes.len() {
                return Ok(offset);
            }
            return Err(StorageError::corrupt_journal("journal-checksum"));
        }

        let frame = decode_wal_payload(payload)?;
        if frame.revision <= *revision {
            *next_transaction_id = (*next_transaction_id).max(frame.transaction_id);
            offset = payload_end;
            continue;
        }
        if frame.revision != revision.saturating_add(1) {
            return Err(StorageError::corrupt_journal("journal-revision"));
        }
        if frame.schema_version == 0 || frame.schema_version > CURRENT_SCHEMA_VERSION {
            return Err(StorageError::unsupported_schema("journal-schema"));
        }
        if allow_initial_schema && *revision == 0 && journal.is_empty() {
            *schema_version = frame.schema_version;
        } else if frame.schema_version < *schema_version {
            return Err(StorageError::corrupt_journal("journal-schema-order"));
        }
        validate_mutations(&frame.mutations)?;
        for mutation in &frame.mutations {
            table.apply(mutation);
        }
        *revision = frame.revision;
        *next_transaction_id = (*next_transaction_id).max(frame.transaction_id);
        *schema_version = frame.schema_version;
        journal.push(JournalEntry {
            transaction_id: frame.transaction_id,
            revision: frame.revision,
            mutation_count: frame.mutations.len(),
        });
        offset = payload_end;
    }
    Ok(offset)
}

fn encode_wal_payload(frame: &WalFrame) -> StorageResult<Vec<u8>> {
    let mut bytes = Vec::new();
    push_u64(&mut bytes, frame.transaction_id);
    push_u64(&mut bytes, frame.revision);
    push_u32(&mut bytes, frame.schema_version);
    push_u64(
        &mut bytes,
        u64::try_from(frame.mutations.len())
            .map_err(|_| StorageError::invalid_format("journal-count"))?,
    );
    for mutation in &frame.mutations {
        encode_mutation(&mut bytes, mutation)?;
    }
    Ok(bytes)
}

fn decode_wal_payload(bytes: &[u8]) -> StorageResult<WalFrame> {
    let mut cursor = Cursor::new(bytes);
    let transaction_id = cursor.u64()?;
    let revision = cursor.u64()?;
    let schema_version = cursor.u32()?;
    let count = cursor.count(MAX_RECORDS, "journal-count")?;
    let mut mutations = Vec::with_capacity(count);
    for _ in 0..count {
        mutations.push(cursor.mutation()?);
    }
    cursor.finish("journal-payload")?;
    Ok(WalFrame {
        transaction_id,
        revision,
        schema_version,
        mutations,
    })
}

fn encode_checkpoint(
    schema_version: u32,
    revision: u64,
    next_transaction_id: u64,
    table: &RecordTable,
    journal: &[JournalEntry],
) -> StorageResult<Vec<u8>> {
    let mut body = Vec::new();
    body.extend_from_slice(CHECKPOINT_MAGIC);
    push_u32(&mut body, schema_version);
    push_u64(&mut body, revision);
    push_u64(&mut body, next_transaction_id);
    push_u64(
        &mut body,
        u64::try_from(table.records.len())
            .map_err(|_| StorageError::invalid_format("checkpoint-count"))?,
    );
    for (key, value) in &table.records {
        push_string(&mut body, key.table())?;
        push_string(&mut body, key.key())?;
        push_bytes(&mut body, value)?;
    }
    push_u64(
        &mut body,
        u64::try_from(journal.len())
            .map_err(|_| StorageError::invalid_format("checkpoint-journal-count"))?,
    );
    for entry in journal {
        push_u64(&mut body, entry.transaction_id);
        push_u64(&mut body, entry.revision);
        push_u64(
            &mut body,
            u64::try_from(entry.mutation_count)
                .map_err(|_| StorageError::invalid_format("checkpoint-mutation-count"))?,
        );
    }
    let checksum = checksum(&body);
    body.extend_from_slice(&checksum.to_le_bytes());
    Ok(body)
}

fn decode_checkpoint(
    bytes: &[u8],
) -> StorageResult<(RecordTable, u64, u64, u32, Vec<JournalEntry>)> {
    if bytes.len() < 4 + 4 + 8 + 8 + 8 + 8 {
        return Err(StorageError::invalid_format("checkpoint-header"));
    }
    let checksum_offset = bytes
        .len()
        .checked_sub(8)
        .ok_or_else(|| StorageError::invalid_format("checkpoint-size"))?;
    let expected = read_u64(&bytes[checksum_offset..])?;
    if checksum(&bytes[..checksum_offset]) != expected {
        return Err(StorageError::invalid_format("checkpoint-checksum"));
    }
    let mut cursor = Cursor::new(&bytes[..checksum_offset]);
    if cursor.take(4)? != CHECKPOINT_MAGIC {
        return Err(StorageError::invalid_format("checkpoint-magic"));
    }
    let schema_version = cursor.u32()?;
    let revision = cursor.u64()?;
    let next_transaction_id = cursor.u64()?;
    let count = cursor.count(MAX_RECORDS, "checkpoint-count")?;
    let mut table = RecordTable::default();
    for _ in 0..count {
        let table_name = cursor.string("checkpoint-table")?;
        let key_name = cursor.string("checkpoint-key")?;
        let value = cursor.bytes("checkpoint-value")?;
        table.insert_for_rebuild(RecordKey::new(table_name, key_name)?, value)?;
    }
    let journal_count = cursor.count(MAX_RECORDS, "checkpoint-journal-count")?;
    let mut journal = Vec::with_capacity(journal_count);
    for _ in 0..journal_count {
        let transaction_id = cursor.u64()?;
        let revision = cursor.u64()?;
        let mutation_count = cursor.count(MAX_RECORDS, "checkpoint-mutation-count")?;
        journal.push(JournalEntry {
            transaction_id,
            revision,
            mutation_count,
        });
    }
    cursor.finish("checkpoint-payload")?;
    Ok((
        table,
        revision,
        next_transaction_id,
        schema_version,
        journal,
    ))
}

fn encode_mutation(bytes: &mut Vec<u8>, mutation: &RecordMutation) -> StorageResult<()> {
    push_string(bytes, mutation.key.table())?;
    push_string(bytes, mutation.key.key())?;
    match &mutation.value {
        Some(value) => {
            bytes.push(1);
            push_bytes(bytes, value)?;
        }
        None => bytes.push(0),
    }
    Ok(())
}

fn push_string(bytes: &mut Vec<u8>, value: &str) -> StorageResult<()> {
    push_bytes(bytes, value.as_bytes())
}

fn push_bytes(bytes: &mut Vec<u8>, value: &[u8]) -> StorageResult<()> {
    let length =
        u64::try_from(value.len()).map_err(|_| StorageError::invalid_format("value-size"))?;
    push_u64(bytes, length);
    bytes.extend_from_slice(value);
    Ok(())
}

fn push_u32(bytes: &mut Vec<u8>, value: u32) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn push_u64(bytes: &mut Vec<u8>, value: u64) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn read_u64(bytes: &[u8]) -> StorageResult<u64> {
    let array: [u8; 8] = bytes
        .try_into()
        .map_err(|_| StorageError::invalid_format("integer"))?;
    Ok(u64::from_le_bytes(array))
}

fn checksum(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

struct Cursor<'a> {
    bytes: &'a [u8],
    offset: usize,
}

impl<'a> Cursor<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, offset: 0 }
    }

    fn take(&mut self, length: usize) -> StorageResult<&'a [u8]> {
        let end = self
            .offset
            .checked_add(length)
            .ok_or_else(|| StorageError::invalid_format("payload-size"))?;
        if end > self.bytes.len() {
            return Err(StorageError::invalid_format("payload-truncated"));
        }
        let value = &self.bytes[self.offset..end];
        self.offset = end;
        Ok(value)
    }

    fn u32(&mut self) -> StorageResult<u32> {
        let bytes: [u8; 4] = self
            .take(4)?
            .try_into()
            .map_err(|_| StorageError::invalid_format("integer"))?;
        Ok(u32::from_le_bytes(bytes))
    }

    fn u64(&mut self) -> StorageResult<u64> {
        read_u64(self.take(8)?)
    }

    fn count(&mut self, max: u64, operation: &'static str) -> StorageResult<usize> {
        let value = self.u64()?;
        if value > max {
            return Err(StorageError::invalid_format(operation));
        }
        usize::try_from(value).map_err(|_| StorageError::invalid_format(operation))
    }

    fn bytes(&mut self, operation: &'static str) -> StorageResult<Vec<u8>> {
        let length = self.u64()?;
        if length > MAX_FRAME_BYTES {
            return Err(StorageError::invalid_format(operation));
        }
        Ok(self
            .take(usize::try_from(length).map_err(|_| StorageError::invalid_format(operation))?)?
            .to_vec())
    }

    fn string(&mut self, operation: &'static str) -> StorageResult<String> {
        String::from_utf8(self.bytes(operation)?)
            .map_err(|_| StorageError::invalid_format(operation))
    }

    fn mutation(&mut self) -> StorageResult<RecordMutation> {
        let table = self.string("journal-table")?;
        let key = self.string("journal-key")?;
        let record_key = RecordKey::new(table, key)?;
        match self.take(1)?[0] {
            0 => Ok(RecordMutation::delete(record_key)),
            1 => RecordMutation::put(record_key, self.bytes("journal-value")?),
            _ => Err(StorageError::invalid_format("journal-operation")),
        }
    }

    fn finish(&self, operation: &'static str) -> StorageResult<()> {
        if self.offset == self.bytes.len() {
            Ok(())
        } else {
            Err(StorageError::invalid_format(operation))
        }
    }
}

fn atomic_replace(target: &Path, bytes: &[u8]) -> StorageResult<()> {
    let parent = target
        .parent()
        .ok_or_else(|| StorageError::io("checkpoint-parent"))?;
    let file_name = target
        .file_name()
        .ok_or_else(|| StorageError::io("checkpoint-name"))?
        .to_string_lossy();
    let temp_name = format!(
        ".{file_name}.tmp-{}-{}",
        std::process::id(),
        checksum(bytes)
    );
    let temp = parent.join(temp_name);
    write_file(&temp, bytes, "write-checkpoint")?;

    if fs::rename(&temp, target).is_err() {
        if target.exists() {
            fs::remove_file(target).map_err(|_| StorageError::io("replace-checkpoint"))?;
        }
        fs::rename(&temp, target).map_err(|_| StorageError::io("replace-checkpoint"))?;
    }
    sync_directory(parent);
    Ok(())
}

fn sync_directory(path: &Path) {
    #[cfg(unix)]
    {
        if let Ok(directory) = File::open(path) {
            let _ = directory.sync_all();
        }
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
}

fn collect_portable_files(root: &Path) -> StorageResult<Vec<(String, Vec<u8>)>> {
    if !root.is_dir() {
        return Err(StorageError::invalid_portable("portable-root"));
    }
    let workspace_path = root.join("workspace.json");
    let workspace = read_file(&workspace_path, "portable-index")?;
    if !is_portable_v4_workspace(&workspace) {
        return Err(StorageError::invalid_portable("portable-version"));
    }

    let mut paths = Vec::new();
    collect_files_recursive(root, &mut paths)?;
    paths.sort();
    let mut files = Vec::with_capacity(paths.len());
    for path in paths {
        let relative = portable_relative_path(root, &path)?;
        let bytes = read_file(&path, "portable-file")?;
        files.push((relative, bytes));
    }
    Ok(files)
}

fn collect_files_recursive(current: &Path, output: &mut Vec<PathBuf>) -> StorageResult<()> {
    let entries = fs::read_dir(current).map_err(|_| StorageError::io("portable-list"))?;
    for entry in entries {
        let entry = entry.map_err(|_| StorageError::io("portable-list"))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|_| StorageError::io("portable-stat"))?;
        if file_type.is_dir() {
            collect_files_recursive(&path, output)?;
        } else if file_type.is_file() {
            output.push(path);
        }
    }
    Ok(())
}

fn portable_relative_path(root: &Path, path: &Path) -> StorageResult<String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| StorageError::invalid_portable("portable-path"))?;
    let mut components = Vec::new();
    for component in relative.components() {
        match component {
            Component::Normal(value) => components.push(value.to_string_lossy().into_owned()),
            _ => return Err(StorageError::invalid_portable("portable-path")),
        }
    }
    if components.is_empty() {
        return Err(StorageError::invalid_portable("portable-path"));
    }
    Ok(components.join("/"))
}

fn is_portable_v4_workspace(bytes: &[u8]) -> bool {
    let Ok(text) = std::str::from_utf8(bytes) else {
        return false;
    };
    let compact: String = text
        .chars()
        .filter(|character| !character.is_whitespace())
        .collect();
    compact.contains("\"version\":4") || compact.contains("\"formatVersion\":4")
}
