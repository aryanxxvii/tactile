use std::fmt;

/// Stable, UI-safe storage failure categories.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StorageErrorCode {
    Io,
    InvalidFormat,
    CorruptJournal,
    UnsupportedSchema,
    InvalidRecord,
    InvalidPortable,
    MigrationFailed,
    TransactionConflict,
    RecoveryFailed,
}

impl StorageErrorCode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Io => "io",
            Self::InvalidFormat => "invalid-format",
            Self::CorruptJournal => "corrupt-journal",
            Self::UnsupportedSchema => "unsupported-schema",
            Self::InvalidRecord => "invalid-record",
            Self::InvalidPortable => "invalid-portable",
            Self::MigrationFailed => "migration-failed",
            Self::TransactionConflict => "transaction-conflict",
            Self::RecoveryFailed => "recovery-failed",
        }
    }
}

/// Error returned by the private native storage layer.
///
/// The operation is deliberately a static label.  Neither `Display` nor
/// `Debug` carries an OS path or a raw database error, so this type can be
/// mapped to a UI error without leaking internal storage details.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StorageError {
    code: StorageErrorCode,
    operation: &'static str,
}

impl StorageError {
    pub const fn new(code: StorageErrorCode, operation: &'static str) -> Self {
        Self { code, operation }
    }

    pub const fn code(self) -> StorageErrorCode {
        self.code
    }

    pub const fn operation(self) -> &'static str {
        self.operation
    }

    pub const fn io(operation: &'static str) -> Self {
        Self::new(StorageErrorCode::Io, operation)
    }

    pub const fn invalid_format(operation: &'static str) -> Self {
        Self::new(StorageErrorCode::InvalidFormat, operation)
    }

    pub const fn corrupt_journal(operation: &'static str) -> Self {
        Self::new(StorageErrorCode::CorruptJournal, operation)
    }

    pub const fn unsupported_schema(operation: &'static str) -> Self {
        Self::new(StorageErrorCode::UnsupportedSchema, operation)
    }

    pub const fn invalid_record(operation: &'static str) -> Self {
        Self::new(StorageErrorCode::InvalidRecord, operation)
    }

    pub const fn invalid_portable(operation: &'static str) -> Self {
        Self::new(StorageErrorCode::InvalidPortable, operation)
    }

    pub const fn migration_failed(operation: &'static str) -> Self {
        Self::new(StorageErrorCode::MigrationFailed, operation)
    }

    pub const fn transaction_conflict(operation: &'static str) -> Self {
        Self::new(StorageErrorCode::TransactionConflict, operation)
    }

    pub const fn recovery_failed(operation: &'static str) -> Self {
        Self::new(StorageErrorCode::RecoveryFailed, operation)
    }
}

impl fmt::Display for StorageError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "storage {} ({})",
            self.code.as_str(),
            self.operation
        )
    }
}

impl std::error::Error for StorageError {}

pub type StorageResult<T> = Result<T, StorageError>;
