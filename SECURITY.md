# Security policy

Tactile is a pre-release local-first workspace. This document records the current engineering posture; it is not a promise of a supported-version SLA, a vulnerability-disclosure service, or a security certification.

## Reporting status

No security email address, private intake URL, or security team identity is evidenced in this repository. That is an owner action item. Before public distribution, a maintainer must configure a private reporting path, document its access owner, and state the expected acknowledgement and remediation process.

Until that path exists:

- do not put credentials, private workspace content, or exploit details in a public issue;
- use the repository's configured private channel if one is supplied by the project owner outside this file;
- use normal issue/review workflow only for non-sensitive defects.

## Supported versions

No public release line or supported-version window is declared. The repository currently identifies the web and native package as `0.0.0`. The release owner must define supported branches, end-of-life rules, and an advisory process before publishing a release.

## Current controls evidenced in the repository

- The product is designed to keep workspace data local; network access is optional.
- The production Tauri CSP has no network or WebSocket source. Development CSP is limited to the loopback Vite server and its HMR WebSocket.
- The Tauri main capability grants no Tauri or plugin permissions, has no remote URL scope, disables the global Tauri object, freezes prototypes, and leaves the asset protocol disabled.
- Portable import validates format/version, object and cell limits, references, asset sizes, archive paths, entry counts, compression ratio, CRCs, and duplicate entries. Extraction is staged and committed only after validation.
- Native storage uses acknowledged WAL frames and atomic checkpoints in the current recovery scaffold. A torn journal tail is truncated during replay, and a deleted cache can be rebuilt from portable files.
- Storage errors intentionally expose stable categories rather than raw filesystem paths.

These controls are implementation evidence, not a guarantee that every object renderer, WebView, operating-system file handler, or future plugin is safe. See [security knowledge](.agents/knowledge/security.md) for residual risks and release gates.

## Reporting useful evidence

For a non-sensitive report, include the affected commit, operating system/runtime, reproduction steps, expected and observed behavior, whether the input is a portable JSON/ZIP workspace or native asset, and the smallest safe fixture. Redact paths, workspace contents, tokens, and personal data.

For a sensitive report, wait for the owner-configured private channel. Do not attach a malicious archive or executable asset to a public issue.

## Supply-chain response

Dependency changes must update the relevant lockfile and regenerate `evidence/release/sbom-npm.cdx.json`, `evidence/release/sbom-cargo.cdx.json`, and `evidence/release/third-party-inventory.json`. Run the applicable audit and test gates, record exceptions, and require owner/legal review of license obligations. The current repository does not evidence a signing key, provenance service, or complete third-party notice bundle; those are release prerequisites.

## Owner prerequisites before a public release

| Item                                    | Current state                       | Required owner action                                                                |
| --------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| Private vulnerability intake            | Not evidenced                       | Name an owner and publish a private path.                                            |
| Supported versions and response targets | Not declared                        | Define supported branches, acknowledgement, and remediation policy.                  |
| Artifact signing and key custody        | Not evidenced                       | Choose a signing system, protect credentials, and publish verification instructions. |
| Project license and third-party notices | Not evidenced                       | Obtain legal decision, add the project license, and distribute required notices.     |
| Cross-platform native security smoke    | Not complete in repository evidence | Run and retain the Windows/macOS/Ubuntu matrix before release.                       |
