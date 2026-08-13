use std::collections::BTreeMap;

use super::error::{StorageError, StorageResult};

const MAX_RECORD_KEY_BYTES: usize = 1024 * 1024;
const MAX_RECORD_VALUE_BYTES: usize = 16 * 1024 * 1024;

/// Stable table/key identity for a record in the native cache.
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct RecordKey {
    table: String,
    key: String,
}

impl RecordKey {
    pub fn new(table: impl Into<String>, key: impl Into<String>) -> StorageResult<Self> {
        let table = table.into();
        let key = key.into();
        if table.is_empty() || key.is_empty() || table.contains('\0') || key.contains('\0') {
            return Err(StorageError::invalid_record("record-key"));
        }
        if table.len().saturating_add(key.len()) > MAX_RECORD_KEY_BYTES {
            return Err(StorageError::invalid_record("record-key-size"));
        }
        Ok(Self { table, key })
    }

    pub fn table(&self) -> &str {
        &self.table
    }

    pub fn key(&self) -> &str {
        &self.key
    }
}

/// A single write or delete in a transaction.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecordMutation {
    pub(crate) key: RecordKey,
    pub(crate) value: Option<Vec<u8>>,
}

impl RecordMutation {
    pub fn put(key: RecordKey, value: impl Into<Vec<u8>>) -> StorageResult<Self> {
        let value = value.into();
        if value.len() > MAX_RECORD_VALUE_BYTES {
            return Err(StorageError::invalid_record("record-value-size"));
        }
        Ok(Self {
            key,
            value: Some(value),
        })
    }

    pub fn delete(key: RecordKey) -> Self {
        Self { key, value: None }
    }

    pub fn key(&self) -> &RecordKey {
        &self.key
    }

    pub fn value(&self) -> Option<&[u8]> {
        self.value.as_deref()
    }
}

/// A record-oriented transaction assembled before it is acknowledged.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct Transaction {
    mutations: Vec<RecordMutation>,
}

impl Transaction {
    pub fn put(
        &mut self,
        table: impl Into<String>,
        key: impl Into<String>,
        value: impl Into<Vec<u8>>,
    ) -> StorageResult<()> {
        let key = RecordKey::new(table, key)?;
        self.mutations.push(RecordMutation::put(key, value)?);
        Ok(())
    }

    pub fn delete(
        &mut self,
        table: impl Into<String>,
        key: impl Into<String>,
    ) -> StorageResult<()> {
        self.mutations
            .push(RecordMutation::delete(RecordKey::new(table, key)?));
        Ok(())
    }

    pub fn is_empty(&self) -> bool {
        self.mutations.is_empty()
    }

    pub(crate) fn mutations(&self) -> &[RecordMutation] {
        &self.mutations
    }
}

/// The in-memory record table reconstructed from a checkpoint and WAL.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct RecordTable {
    pub(crate) records: BTreeMap<RecordKey, Vec<u8>>,
}

impl RecordTable {
    pub fn get(&self, table: &str, key: &str) -> Option<&[u8]> {
        self.records
            .get(&RecordKey {
                table: table.to_owned(),
                key: key.to_owned(),
            })
            .map(Vec::as_slice)
    }

    pub fn contains(&self, table: &str, key: &str) -> bool {
        self.get(table, key).is_some()
    }

    pub fn len(&self) -> usize {
        self.records.len()
    }

    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }

    pub fn iter(&self) -> impl Iterator<Item = (&RecordKey, &[u8])> {
        self.records
            .iter()
            .map(|(key, value)| (key, value.as_slice()))
    }

    /// Updates one record while a migration is constructing its candidate
    /// table.  Normal edits should use [`Transaction`] and [`Storage::commit`].
    pub fn put(
        &mut self,
        table: impl Into<String>,
        key: impl Into<String>,
        value: impl Into<Vec<u8>>,
    ) -> StorageResult<()> {
        let mutation = RecordMutation::put(RecordKey::new(table, key)?, value)?;
        self.apply(&mutation);
        Ok(())
    }

    /// Deletes one record while a migration is constructing its candidate
    /// table.
    pub fn delete(
        &mut self,
        table: impl Into<String>,
        key: impl Into<String>,
    ) -> StorageResult<()> {
        let mutation = RecordMutation::delete(RecordKey::new(table, key)?);
        self.apply(&mutation);
        Ok(())
    }

    pub(crate) fn apply(&mut self, mutation: &RecordMutation) {
        match &mutation.value {
            Some(value) => {
                self.records.insert(mutation.key.clone(), value.clone());
            }
            None => {
                self.records.remove(&mutation.key);
            }
        }
    }

    pub(crate) fn clear(&mut self) {
        self.records.clear();
    }

    pub(crate) fn insert_for_rebuild(
        &mut self,
        key: RecordKey,
        value: Vec<u8>,
    ) -> StorageResult<()> {
        if value.len() > MAX_RECORD_VALUE_BYTES {
            return Err(StorageError::invalid_record("record-value-size"));
        }
        self.records.insert(key, value);
        Ok(())
    }
}
