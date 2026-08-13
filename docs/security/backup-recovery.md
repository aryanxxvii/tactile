# Backup and recovery

Tactile treats the local portable copy as canonical. Browser caches and the private native cache are recoverable working stores, not the user's only copy. The current product does not evidence cloud backup, automatic off-device replication, encryption at rest, or a user-facing cache-directory contract; users and release owners must not assume those protections.

## Before risky work

1. Close edits or wait for the persistence acknowledgement/checkpoint exposed by the active runtime.
2. Export the workspace as portable JSON or ZIP to a new, versioned destination. Do not overwrite the only copy.
3. Preserve the original bundle and record its SHA-256 hash with the date and tool used.
4. Keep the backup on storage with access controls appropriate to its contents. Portable files can contain the full workspace and native assets.
5. For a migration or release test, work on a duplicate and retain the untouched fixture.

Example hash commands (run against a file, not a directory):

```text
Get-FileHash .\workspace.tactile -Algorithm SHA256
sha256sum ./workspace.tactile
```

## Restore workflow

1. Keep the source backup immutable. Choose a fresh destination that does not already exist.
2. Import the JSON or ZIP through the application/native portable boundary. v4 imports validate the manifest, workspace index, references, archive paths, resource sizes, and checksums before staged extraction.
3. If validation fails, preserve the error and source bundle; do not edit the only backup to make the error disappear. Repair a copy and re-hash it.
4. Confirm the home/start object, object titles, nested parent links, sheet used range, Markdown content, and native asset bytes.
5. Export the restored workspace again and compare the important files or hashes. Keep both the original and restored copies until the comparison is complete.

## Native cache recovery

The original native storage scaffold replays acknowledged WAL frames on reopen, repairs a truncated journal tail, writes checkpoints atomically, rolls back failed migrations, and can rebuild a deleted/empty cache from portable v4 files. The tree also contains a private `rusqlite`-backed SQLite/WAL service with a focused reopen/checkpoint test. Its integration with every Tauri persistence command and its cross-platform behavior are not yet evidenced as release-complete. The public recovery contract remains the portable copy. Do not tell users to delete arbitrary application directories; use an owner-approved recovery flow once the native shell exposes one.

## Incident preservation

For corruption or suspected tampering, preserve the original bundle, hash it, record the application/native version and operating system, and copy only a redacted fixture for debugging. Do not upload user workspaces or executable/native assets to a public issue. Follow the private reporting prerequisites in `SECURITY.md` when a security issue may be involved.

## Recovery test checklist

- [ ] Untouched portable JSON opens and re-exports.
- [ ] ZIP with an invalid path is rejected before destination creation.
- [ ] Oversized archive/resource is rejected without partial destination state.
- [ ] Unknown fields and native resources survive v4 round trip.
- [ ] Deleted cache rebuilds from the portable files.
- [ ] A torn WAL tail does not discard acknowledged records.
- [ ] A failed migration leaves the prior checkpoint and revision intact.
- [ ] Restored nested links, aliases, and start metadata are verified.
