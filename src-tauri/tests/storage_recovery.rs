#[path = "../src/storage/mod.rs"]
mod storage;

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use storage::{Storage, StorageErrorCode};

struct TempDir {
    path: PathBuf,
}

impl TempDir {
    fn new(label: &str) -> Self {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock must be after unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "tactile-e02-{label}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("temporary directory should be creatable");
        Self { path }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

#[test]
fn acknowledged_edit_is_recovered_from_wal_without_checkpoint() {
    let root = TempDir::new("ack-recovery");
    let record = b"acknowledged value".to_vec();

    {
        let mut storage = Storage::open(root.path()).expect("storage should open");
        let mut transaction = storage.begin_transaction();
        transaction
            .put("cell", "sheet-home:A1", record.clone())
            .expect("record should be valid");
        let receipt = storage.commit(transaction).expect("ack should be durable");
        assert_eq!(receipt.revision, 1);
        assert_eq!(storage.journal()[0].transaction_id, receipt.transaction_id);
        assert!(!root.path().join("checkpoint.bin").exists());
    }

    let reopened = Storage::open(root.path()).expect("WAL should replay on reopen");
    assert_eq!(reopened.revision(), 1);
    assert_eq!(
        reopened.table().get("cell", "sheet-home:A1"),
        Some(record.as_slice())
    );
}

#[test]
fn failed_migration_rolls_back_memory_and_disk_state() {
    let root = TempDir::new("migration-rollback");
    {
        let mut storage = Storage::open_at_schema(root.path(), 1).expect("old schema should open");
        let mut transaction = storage.begin_transaction();
        transaction
            .put("object", "sheet-home", b"before-migration".to_vec())
            .expect("record should be valid");
        storage
            .commit(transaction)
            .expect("seed edit should commit");
        storage.checkpoint().expect("seed checkpoint should commit");

        let error = storage
            .migrate_to(2, |table| {
                table
                    .put("object", "sheet-home", b"partial-migration".to_vec())
                    .expect("migration record should be valid");
                Err(storage::StorageError::migration_failed("fixture-failure"))
            })
            .expect_err("fixture migration should fail");
        assert_eq!(error.code(), StorageErrorCode::MigrationFailed);
        assert_eq!(storage.schema_version(), 1);
        assert_eq!(
            storage.table().get("object", "sheet-home"),
            Some(b"before-migration".as_slice())
        );
    }

    let reopened = Storage::open(root.path()).expect("rollback state should reopen");
    assert_eq!(reopened.schema_version(), 1);
    assert_eq!(
        reopened.table().get("object", "sheet-home"),
        Some(b"before-migration".as_slice())
    );
    assert_eq!(reopened.revision(), 1);
}

#[test]
fn deleted_cache_rebuilds_same_portable_v4_files() {
    let portable = TempDir::new("portable");
    let cache = TempDir::new("cache");
    fs::create_dir_all(portable.path().join("objects")).expect("objects directory should exist");
    fs::create_dir_all(portable.path().join("assets")).expect("assets directory should exist");
    fs::write(
        portable.path().join("workspace.json"),
        br#"{"format":"tactile","version":4,"id":"ws-e02"}"#,
    )
    .expect("portable index should be writable");
    fs::write(
        portable.path().join("objects/home.csv"),
        b"A1,B1\nProject,Notes\n",
    )
    .expect("portable sheet should be writable");
    fs::write(
        portable.path().join("assets/readme.md"),
        b"# Portable notes\n",
    )
    .expect("portable asset should be writable");

    let first = Storage::open_or_rebuild_from_portable_files(cache.path(), portable.path())
        .expect("portable files should rebuild cache");
    let expected: Vec<(String, Vec<u8>)> = first
        .table()
        .iter()
        .map(|(key, value)| (format!("{}/{}", key.table(), key.key()), value.to_vec()))
        .collect();
    assert_eq!(first.journal().len(), 1);
    drop(first);

    fs::remove_file(cache.path().join("checkpoint.bin"))
        .expect("cache checkpoint should be deleted");
    fs::remove_file(cache.path().join("journal.wal")).expect("cache journal should be deleted");

    let rebuilt = Storage::open_or_rebuild_from_portable_files(cache.path(), portable.path())
        .expect("deleted cache should rebuild on reopen");
    let actual: Vec<(String, Vec<u8>)> = rebuilt
        .table()
        .iter()
        .map(|(key, value)| (format!("{}/{}", key.table(), key.key()), value.to_vec()))
        .collect();
    assert_eq!(actual, expected);
    assert_eq!(rebuilt.table().len(), 3);
}

#[test]
fn storage_errors_do_not_expose_internal_paths() {
    let root = TempDir::new("error-surface");
    let missing = root.path().join("missing-portable");
    let error = Storage::open_or_rebuild_from_portable_files(root.path().join("cache"), &missing)
        .expect_err("missing portable root should fail");
    assert_eq!(error.code(), StorageErrorCode::InvalidPortable);
    assert!(!error
        .to_string()
        .contains(missing.to_string_lossy().as_ref()));
}
