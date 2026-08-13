use super::error::{StorageError, StorageResult};
use super::records::Transaction;
use super::CommitReceipt;
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use std::fs;
use std::path::{Path, PathBuf};

const SCHEMA_VERSION: i64 = 1;

/// Private SQLite/WAL runtime index. User content remains in the portable
/// files; this database only stores durable records and recovery metadata.
pub struct SqliteStorage {
    root: PathBuf,
    connection: Connection,
    revision: u64,
    next_transaction_id: u64,
}

impl SqliteStorage {
    pub fn open(root: impl AsRef<Path>) -> StorageResult<Self> {
        let root = root.as_ref();
        fs::create_dir_all(root).map_err(|_| StorageError::io("sqlite-open"))?;
        let connection = Connection::open(root.join("workspace.sqlite3"))
            .map_err(|_| StorageError::io("sqlite-open"))?;
        connection
            .pragma_update(None, "journal_mode", "WAL")
            .map_err(|_| StorageError::io("sqlite-wal"))?;
        connection
            .pragma_update(None, "synchronous", "FULL")
            .map_err(|_| StorageError::io("sqlite-sync"))?;
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .map_err(|_| StorageError::io("sqlite-foreign-keys"))?;
        connection
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS tactile_meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
                 CREATE TABLE IF NOT EXISTS tactile_records (
                   table_name TEXT NOT NULL,
                   record_key TEXT NOT NULL,
                   value BLOB NOT NULL,
                   PRIMARY KEY (table_name, record_key)
                 );
                 CREATE TABLE IF NOT EXISTS tactile_transactions (
                   transaction_id INTEGER PRIMARY KEY,
                   revision INTEGER NOT NULL UNIQUE,
                   mutation_count INTEGER NOT NULL
                 );",
            )
            .map_err(|_| StorageError::io("sqlite-schema"))?;
        let schema = read_meta(&connection, "schema_version")?.unwrap_or(SCHEMA_VERSION);
        if schema != SCHEMA_VERSION {
            return Err(StorageError::unsupported_schema("sqlite-schema"));
        }
        write_meta(&connection, "schema_version", SCHEMA_VERSION)?;
        let revision = read_meta(&connection, "revision")?.unwrap_or(0);
        let next_transaction_id = read_meta(&connection, "next_transaction_id")?.unwrap_or(0);
        Ok(Self {
            root: root.to_owned(),
            connection,
            revision: u64::try_from(revision)
                .map_err(|_| StorageError::invalid_format("sqlite-revision"))?,
            next_transaction_id: u64::try_from(next_transaction_id)
                .map_err(|_| StorageError::invalid_format("sqlite-transaction"))?,
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn revision(&self) -> u64 {
        self.revision
    }

    pub fn get(&self, table: &str, key: &str) -> StorageResult<Option<Vec<u8>>> {
        self.connection
            .query_row(
                "SELECT value FROM tactile_records WHERE table_name = ?1 AND record_key = ?2",
                params![table, key],
                |row| row.get(0),
            )
            .optional()
            .map_err(|_| StorageError::io("sqlite-read"))
    }

    pub fn commit(&mut self, transaction: Transaction) -> StorageResult<CommitReceipt> {
        if transaction.is_empty() {
            return Err(StorageError::transaction_conflict(
                "sqlite-empty-transaction",
            ));
        }
        let transaction_id = self
            .next_transaction_id
            .checked_add(1)
            .ok_or_else(|| StorageError::recovery_failed("sqlite-transaction-sequence"))?;
        let revision = self
            .revision
            .checked_add(1)
            .ok_or_else(|| StorageError::recovery_failed("sqlite-revision-sequence"))?;
        let count = transaction.mutations().len() as i64;
        let sql_transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|_| StorageError::io("sqlite-begin"))?;
        for mutation in transaction.mutations() {
            let table = mutation.key().table();
            let key = mutation.key().key();
            match mutation.value() {
                Some(value) => {
                    sql_transaction
                        .execute(
                            "INSERT INTO tactile_records(table_name, record_key, value) VALUES (?1, ?2, ?3)
                             ON CONFLICT(table_name, record_key) DO UPDATE SET value = excluded.value",
                            params![table, key, value],
                        )
                        .map_err(|_| StorageError::io("sqlite-write"))?;
                }
                None => {
                    sql_transaction
                        .execute(
                            "DELETE FROM tactile_records WHERE table_name = ?1 AND record_key = ?2",
                            params![table, key],
                        )
                        .map_err(|_| StorageError::io("sqlite-delete"))?;
                }
            }
        }
        sql_transaction
            .execute(
                "INSERT INTO tactile_transactions(transaction_id, revision, mutation_count) VALUES (?1, ?2, ?3)",
                params![transaction_id as i64, revision as i64, count],
            )
            .map_err(|_| StorageError::io("sqlite-journal"))?;
        write_meta_in_transaction(&sql_transaction, "revision", revision as i64)?;
        write_meta_in_transaction(
            &sql_transaction,
            "next_transaction_id",
            transaction_id as i64,
        )?;
        sql_transaction
            .commit()
            .map_err(|_| StorageError::io("sqlite-commit"))?;
        self.revision = revision;
        self.next_transaction_id = transaction_id;
        Ok(CommitReceipt {
            transaction_id,
            revision,
        })
    }

    pub fn checkpoint(&self) -> StorageResult<()> {
        self.connection
            .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
            .map_err(|_| StorageError::io("sqlite-checkpoint"))
    }

    pub fn migrate_to(&self, target_schema: u32) -> StorageResult<()> {
        if target_schema != SCHEMA_VERSION as u32 {
            return Err(StorageError::unsupported_schema("sqlite-migration"));
        }
        Ok(())
    }
}

fn read_meta(connection: &Connection, key: &str) -> StorageResult<Option<i64>> {
    connection
        .query_row(
            "SELECT value FROM tactile_meta WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|_| StorageError::io("sqlite-meta-read"))
}

fn write_meta(connection: &Connection, key: &str, value: i64) -> StorageResult<()> {
    connection
        .execute(
            "INSERT INTO tactile_meta(key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
        .map_err(|_| StorageError::io("sqlite-meta-write"))?;
    Ok(())
}

fn write_meta_in_transaction(
    transaction: &rusqlite::Transaction<'_>,
    key: &str,
    value: i64,
) -> StorageResult<()> {
    transaction
        .execute(
            "INSERT INTO tactile_meta(key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
        .map_err(|_| StorageError::io("sqlite-meta-write"))?;
    Ok(())
}
