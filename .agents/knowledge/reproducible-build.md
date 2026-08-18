# Release build evidence

Tactile guarantees traceability to immutable source tags, not yet measured bit-for-bit reproducibility across hosted runners.

Required inputs: immutable tag/SHA, Node/npm pins, Rust toolchain, npm/Cargo lockfiles, pinned Tauri invocation, and CI-only credentials.

Required checks include `npm ci`, repository verification, Cargo fmt/check/test/clippy, inventory generation, clean tagged packaging, expected artifact coverage, SHA-256 checksums, and updater signatures. Retain workflow URL, runner/tool versions, lockfile hashes, artifact names/sizes/checksums, signing status, tests, approval, changelog, and rollback target.

Recommended future hardening: exact Rust pin, action SHA pinning, provenance attestations, and measured rebuild comparison.
