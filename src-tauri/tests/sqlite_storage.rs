use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tactile_lib::storage::{SqliteStorage, StorageErrorCode, Transaction};

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
            "tactile-e02-sqlite-{label}-{}-{nonce}",
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
fn acknowledged_sqlite_transaction_survives_reopen() {
    let root = TempDir::new("reopen");
    let mut storage = SqliteStorage::open(root.path()).expect("open sqlite storage");
    let mut transaction = Transaction::default();
    transaction.put("cells", "A1", b"hello").expect("put");
    let receipt = storage.commit(transaction).expect("commit");
    assert_eq!(receipt.revision, 1);
    drop(storage);

    let reopened = SqliteStorage::open(root.path()).expect("reopen sqlite storage");
    assert_eq!(reopened.revision(), 1);
    assert_eq!(
        reopened.get("cells", "A1").expect("read"),
        Some(b"hello".to_vec())
    );
    assert_eq!(reopened.journal().expect("journal").len(), 1);
    reopened.checkpoint().expect("checkpoint");
}

#[test]
fn sqlite_transactions_are_atomic_and_reconstruct_record_tables() {
    let root = TempDir::new("atomic");
    let mut storage = SqliteStorage::open(root.path()).expect("open sqlite storage");

    let mut transaction = storage.begin_transaction();
    transaction
        .put("cells", "A1", b"hello")
        .expect("first record should be valid");
    transaction
        .put("objects", "sheet-home", b"sheet")
        .expect("second record should be valid");
    let receipt = storage.commit(transaction).expect("commit");
    assert_eq!(receipt.revision, 1);

    let table = storage.table().expect("record table");
    assert_eq!(table.len(), 2);
    assert_eq!(table.get("cells", "A1"), Some(b"hello".as_slice()));
    assert_eq!(storage.journal().expect("journal")[0].mutation_count, 2);

    let mut duplicate = storage.begin_transaction();
    duplicate
        .put("cells", "A1", b"not committed")
        .expect("record should be valid");
    duplicate
        .delete("cells", "A1")
        .expect("record should be valid");
    let error = storage
        .commit(duplicate)
        .expect_err("duplicate keys must be rejected before SQL writes");
    assert_eq!(error.code(), StorageErrorCode::TransactionConflict);
    assert_eq!(storage.revision(), 1);
    assert_eq!(
        storage.get("cells", "A1").expect("read"),
        Some(b"hello".to_vec())
    );
}

#[test]
fn sqlite_cache_rebuild_preserves_opaque_portable_files_after_deletion() {
    let portable = TempDir::new("portable");
    let cache = TempDir::new("cache");
    fs::create_dir_all(portable.path().join("objects")).expect("objects directory");
    fs::create_dir_all(portable.path().join("assets")).expect("assets directory");
    fs::write(
        portable.path().join("workspace.json"),
        br#"{"format":"tactile","version":4,"id":"ws-e02-sqlite"}"#,
    )
    .expect("portable index");
    fs::write(
        portable.path().join("objects/home.csv"),
        b"A1,B1\nProject,Notes\n",
    )
    .expect("portable sheet");
    fs::write(
        portable.path().join("assets/readme.md"),
        b"# Portable notes\n",
    )
    .expect("portable markdown");

    let first = SqliteStorage::open_or_rebuild_from_portable_files(cache.path(), portable.path())
        .expect("portable files should rebuild the cache");
    let expected = first.table().expect("first record table");
    assert_eq!(expected.len(), 3);
    assert_eq!(first.revision(), 1);
    drop(first);

    fs::remove_dir_all(cache.path()).expect("cache should be removable");
    let rebuilt = SqliteStorage::open_or_rebuild_from_portable_files(cache.path(), portable.path())
        .expect("deleted cache should rebuild on reopen");
    assert_eq!(rebuilt.table().expect("rebuilt record table"), expected);
    assert_eq!(rebuilt.journal().expect("rebuilt journal").len(), 1);
}
