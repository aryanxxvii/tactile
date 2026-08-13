use tactile_lib::storage::{SqliteStorage, Transaction};

#[test]
fn acknowledged_sqlite_transaction_survives_reopen() {
    let root = std::env::temp_dir().join(format!("tactile-sqlite-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    let mut storage = SqliteStorage::open(&root).expect("open sqlite storage");
    let mut transaction = Transaction::default();
    transaction.put("cells", "A1", b"hello").expect("put");
    let receipt = storage.commit(transaction).expect("commit");
    assert_eq!(receipt.revision, 1);
    drop(storage);

    let reopened = SqliteStorage::open(&root).expect("reopen sqlite storage");
    assert_eq!(reopened.revision(), 1);
    assert_eq!(
        reopened.get("cells", "A1").expect("read"),
        Some(b"hello".to_vec())
    );
    reopened.checkpoint().expect("checkpoint");
    let _ = std::fs::remove_dir_all(root);
}
