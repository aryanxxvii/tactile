use super::error::{StorageError, StorageResult};
use super::records::{RecordKey, RecordMutation, RecordTable, Transaction};
use super::{CommitReceipt, JournalEntry, RebuildReport};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use std::convert::TryFrom;
use std::fs;
use std::path::{Path, PathBuf};

const SCHEMA_VERSION: i64 = 1;
const DATABASE_FILE: &str = "workspace.sqlite3";

/// Private SQLite/WAL runtime index. User content remains in the portable
/// files; this database stores only durable records and recovery metadata.
///
/// The connection and database path never cross this module's typed API. A
/// caller receives records, revisions, and stable [`StorageError`] values,
/// rather than SQL or internal filesystem details.
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
        let connection = Connection::open(root.join(DATABASE_FILE))
            .map_err(|_| StorageError::io("sqlite-open"))?;

        configure_connection(&connection)?;
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
        let storage = Self {
            root: root.to_owned(),
            connection,
            revision: u64::try_from(revision)
                .map_err(|_| StorageError::invalid_format("sqlite-revision"))?,
            next_transaction_id: u64::try_from(next_transaction_id)
                .map_err(|_| StorageError::invalid_format("sqlite-transaction"))?,
        };
        storage.validate_metadata()?;
        Ok(storage)
    }

    fn validate_metadata(&self) -> StorageResult<()> {
        let (max_revision, max_transaction_id): (i64, i64) = self
            .connection
            .query_row(
                "SELECT COALESCE(MAX(revision), 0), COALESCE(MAX(transaction_id), 0)
                 FROM tactile_transactions",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|_| StorageError::io("sqlite-journal-read"))?;
        let max_revision = u64::try_from(max_revision)
            .map_err(|_| StorageError::invalid_format("sqlite-journal-revision"))?;
        let max_transaction_id = u64::try_from(max_transaction_id)
            .map_err(|_| StorageError::invalid_format("sqlite-journal-transaction"))?;
        if self.revision < max_revision {
            return Err(StorageError::recovery_failed("sqlite-revision-metadata"));
        }
        if self.next_transaction_id < max_transaction_id {
            return Err(StorageError::recovery_failed("sqlite-transaction-metadata"));
        }
        Ok(())
    }

    pub(crate) fn root(&self) -> &Path {
        &self.root
    }

    pub fn schema_version(&self) -> u32 {
        SCHEMA_VERSION as u32
    }

    pub fn revision(&self) -> u64 {
        self.revision
    }

    pub fn is_empty(&self) -> StorageResult<bool> {
        self.connection
            .query_row(
                "SELECT NOT EXISTS(SELECT 1 FROM tactile_records)",
                [],
                |row| row.get(0),
            )
            .map_err(|_| StorageError::io("sqlite-empty"))
    }

    pub fn get(&self, table: &str, key: &str) -> StorageResult<Option<Vec<u8>>> {
        let record_key = RecordKey::new(table.to_owned(), key.to_owned())?;
        self.connection
            .query_row(
                "SELECT value FROM tactile_records WHERE table_name = ?1 AND record_key = ?2",
                params![record_key.table(), record_key.key()],
                |row| row.get(0),
            )
            .optional()
            .map_err(|_| StorageError::io("sqlite-read"))
    }

    /// Reconstructs the record-oriented view from SQLite without exposing
    /// the connection or raw database rows to callers.
    pub fn table(&self) -> StorageResult<RecordTable> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT table_name, record_key, value
                 FROM tactile_records ORDER BY table_name, record_key",
            )
            .map_err(|_| StorageError::io("sqlite-record-read"))?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Vec<u8>>(2)?,
                ))
            })
            .map_err(|_| StorageError::io("sqlite-record-read"))?;
        let mut table = RecordTable::default();
        for row in rows {
            let (table_name, key, value) =
                row.map_err(|_| StorageError::io("sqlite-record-read"))?;
            table.insert_for_rebuild(RecordKey::new(table_name, key)?, value)?;
        }
        Ok(table)
    }

    /// Returns the acknowledged revision journal in revision order.
    pub fn journal(&self) -> StorageResult<Vec<JournalEntry>> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT transaction_id, revision, mutation_count
                 FROM tactile_transactions ORDER BY revision",
            )
            .map_err(|_| StorageError::io("sqlite-journal-read"))?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            })
            .map_err(|_| StorageError::io("sqlite-journal-read"))?;
        let mut journal = Vec::new();
        for row in rows {
            let (transaction_id, revision, mutation_count) =
                row.map_err(|_| StorageError::io("sqlite-journal-read"))?;
            let mutation_count = usize::try_from(mutation_count)
                .map_err(|_| StorageError::invalid_format("sqlite-journal-count"))?;
            if mutation_count as u64 > super::MAX_RECORDS {
                return Err(StorageError::invalid_format("sqlite-journal-count"));
            }
            journal.push(JournalEntry {
                transaction_id: u64::try_from(transaction_id)
                    .map_err(|_| StorageError::invalid_format("sqlite-journal-transaction"))?,
                revision: u64::try_from(revision)
                    .map_err(|_| StorageError::invalid_format("sqlite-journal-revision"))?,
                mutation_count,
            });
        }
        Ok(journal)
    }

    pub fn begin_transaction(&self) -> Transaction {
        Transaction::default()
    }

    pub fn commit(&mut self, transaction: Transaction) -> StorageResult<CommitReceipt> {
        super::validate_mutations(transaction.mutations())?;
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
        let transaction_id_i64 = sqlite_integer(transaction_id, "sqlite-transaction-sequence")?;
        let revision_i64 = sqlite_integer(revision, "sqlite-revision-sequence")?;
        let count = i64::try_from(transaction.mutations().len())
            .map_err(|_| StorageError::invalid_format("sqlite-journal-count"))?;
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
                params![transaction_id_i64, revision_i64, count],
            )
            .map_err(|_| StorageError::io("sqlite-journal"))?;
        write_meta_in_transaction(&sql_transaction, "revision", revision_i64)?;
        write_meta_in_transaction(&sql_transaction, "next_transaction_id", transaction_id_i64)?;
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

    /// Opens the native cache and reconstructs it from the opaque portable
    /// files when the database was deleted or has never contained records.
    pub fn open_or_rebuild_from_portable_files(
        cache_root: impl AsRef<Path>,
        portable_root: impl AsRef<Path>,
    ) -> StorageResult<Self> {
        let cache_root = cache_root.as_ref();
        let database_missing = !cache_root.join(DATABASE_FILE).exists();
        let mut storage = Self::open(cache_root)?;
        if database_missing || storage.is_empty()? {
            storage.rebuild_cache_from_portable_files(portable_root)?;
        }
        Ok(storage)
    }

    /// Stores one opaque record per portable file. Portable v4 bytes are
    /// copied as-is; this cache never rewrites or reinterprets that format.
    pub fn rebuild_cache_from_portable_files(
        &mut self,
        portable_root: impl AsRef<Path>,
    ) -> StorageResult<RebuildReport> {
        let files = super::collect_portable_files(portable_root.as_ref())?;
        let mut candidate = RecordTable::default();
        for (relative_path, bytes) in &files {
            let key = RecordKey::new("portable-file", relative_path.clone())?;
            candidate.insert_for_rebuild(key, bytes.clone())?;
        }

        let current = self.table()?;
        let mutations = super::diff_tables(&current, &candidate);
        if !mutations.is_empty() {
            self.commit(transaction_from_mutations(&mutations)?)?;
        }
        self.checkpoint()?;
        Ok(RebuildReport {
            file_count: files.len(),
            revision: self.revision,
        })
    }

    /// SQLite's WAL commit is the acknowledgement boundary. Checkpointing
    /// only compacts that already-committed log; SQLite keeps the data
    /// recoverable if the process terminates before this call completes.
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

fn configure_connection(connection: &Connection) -> StorageResult<()> {
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|_| StorageError::io("sqlite-wal"))?;
    connection
        .pragma_update(None, "synchronous", "FULL")
        .map_err(|_| StorageError::io("sqlite-sync"))?;
    connection
        .pragma_update(None, "foreign_keys", "ON")
        .map_err(|_| StorageError::io("sqlite-foreign-keys"))?;
    let journal_mode: String = connection
        .query_row("PRAGMA journal_mode", [], |row| row.get(0))
        .map_err(|_| StorageError::io("sqlite-wal"))?;
    if !journal_mode.eq_ignore_ascii_case("wal") {
        return Err(StorageError::io("sqlite-wal"));
    }
    Ok(())
}

fn transaction_from_mutations(mutations: &[RecordMutation]) -> StorageResult<Transaction> {
    let mut transaction = Transaction::default();
    for mutation in mutations {
        if let Some(value) = mutation.value() {
            transaction.put(
                mutation.key().table().to_owned(),
                mutation.key().key().to_owned(),
                value.to_vec(),
            )?;
        } else {
            transaction.delete(
                mutation.key().table().to_owned(),
                mutation.key().key().to_owned(),
            )?;
        }
    }
    Ok(transaction)
}

fn sqlite_integer(value: u64, operation: &'static str) -> StorageResult<i64> {
    i64::try_from(value).map_err(|_| StorageError::recovery_failed(operation))
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
