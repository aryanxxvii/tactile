#![allow(dead_code, unused_imports)]

#[path = "../src/assets/mod.rs"]
mod assets;
#[path = "../src/portable/mod.rs"]
mod portable;

use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use assets::{AssetStore, AssetWriteRequest};
use portable::{
    cell_address, coordinates_from_address, create_tactile_link, export_portable, import_portable,
    parse_csv, parse_json, parse_tactile_link, stringify_csv, CancellationToken, ExportEntry,
    JsonValue, OperationControl, PortableErrorCode, PortableImportOptions, PortablePackage,
    ProgressEvent, ProgressSink, ValidationOptions, CURRENT_PORTABLE_VERSION,
};

static TEST_COUNTER: AtomicU64 = AtomicU64::new(1);

fn fixture_package() -> PortablePackage {
    let root = parse_json(include_bytes!("fixtures/v4-roundtrip.json")).expect("fixture JSON");
    let manifest = root.get("manifest").expect("manifest").clone();
    let workspace = root.get("workspace").expect("workspace").clone();
    let mut package = PortablePackage::new(manifest, workspace);
    package.push_resource(ExportEntry::bytes(
        "objects/sheet-home/sheet.csv",
        b"Project,\"Native, notes\"\r\n[[tactile:markdown:doc-notes|Native notes]],value",
    ));
    package.push_resource(ExportEntry::bytes(
        "objects/sheet-home/sheet.meta.json",
        br##"{
  "rows": 256,
  "columns": 64,
  "cells": {
    "A1": {
      "role": "heading",
      "x-cell-plugin": {
        "owner": "e03",
        "ordinal": 1
      }
    },
    "B2": {
      "note": "direct lookup"
    }
  },
  "x-sheet-meta-plugin": {
    "keep": true
  }
}"##,
    ));
    package.push_resource(ExportEntry::bytes(
        "objects/doc-notes/content.md",
        "## Native notes\n\nPortable Markdown stays UTF-8: résumé.\n".as_bytes(),
    ));
    package.push_resource(ExportEntry::bytes(
        "objects/image-ref/content.png",
        vec![0, 1, 2, 3],
    ));
    package.push_resource(ExportEntry::bytes(
        "themes/theme-paper.json",
        br##"{
  "id": "theme-paper",
  "name": "Paper Future",
  "tokens": {
    "paper": "#fbf7ef",
    "futureToken": "#00d4a8"
  },
  "x-theme-plugin": {
    "density": "compact"
  }
}"##,
    ));
    package
}

fn temp_path(label: &str) -> PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    std::env::temp_dir().join(format!(
        "tactile-e03-{label}-{}-{timestamp}",
        TEST_COUNTER.fetch_add(1, Ordering::Relaxed)
    ))
}

fn export_fixture() -> Vec<u8> {
    let package = fixture_package();
    let token = CancellationToken::new();
    let mut control = OperationControl::new(&token);
    let writer = export_portable(Vec::new(), &package, &Default::default(), &mut control)
        .expect("export starts");
    writer.finish().expect("export finishes")
}

fn clean(path: &Path) {
    if path.exists() {
        fs::remove_dir_all(path).expect("clean test path");
    }
}

#[test]
fn v4_unknown_fields_and_native_resources_round_trip() {
    let bytes = export_fixture();
    let destination = temp_path("import");
    let token = CancellationToken::new();
    let mut events = Vec::new();
    let mut sink = |event: ProgressEvent| events.push(event);
    let mut control = OperationControl::with_progress(&token, &mut sink);
    let imported = import_portable(
        Cursor::new(bytes),
        &destination,
        &Default::default(),
        &mut control,
    )
    .expect("portable import");

    assert_eq!(imported.validation.version, CURRENT_PORTABLE_VERSION);
    assert_eq!(
        imported
            .workspace
            .get("x-workspace-plugin")
            .and_then(|value| value.get("preserve"))
            .and_then(JsonValue::as_bool),
        Some(true)
    );
    assert_eq!(
        imported
            .manifest
            .get("x-manifest-plugin")
            .and_then(|value| value.get("preserve"))
            .and_then(JsonValue::as_bool),
        Some(true)
    );
    assert_eq!(
        imported
            .workspace
            .get("objects")
            .and_then(JsonValue::array_value)
            .and_then(|objects| objects.first())
            .and_then(|object| object.get("x-object-plugin"))
            .and_then(|value| value.get("panel"))
            .and_then(JsonValue::as_str),
        Some("milestones")
    );
    assert_eq!(
        imported
            .sheet_metadata("sheet-home")
            .expect("sheet metadata")
            .cell("a1")
            .and_then(|value| value.get("x-cell-plugin"))
            .and_then(|value| value.get("ordinal"))
            .and_then(JsonValue::as_u64),
        Some(1)
    );
    assert_eq!(
        imported
            .sheet_metadata("sheet-home")
            .expect("sheet metadata")
            .cell("B2")
            .and_then(|value| value.get("note"))
            .and_then(JsonValue::as_str),
        Some("direct lookup")
    );
    assert_eq!(
        fs::read(
            imported
                .file_path("objects/doc-notes/content.md")
                .expect("markdown path")
        )
        .expect("markdown bytes"),
        b"## Native notes\n\nPortable Markdown stays UTF-8: r\xc3\xa9sum\xc3\xa9.\n"
    );
    assert!(
        fs::read(
            imported
                .asset("asset-ref")
                .expect("asset")
                .relative_path
                .clone()
                .as_path()
        )
        .err()
        .is_some(),
        "asset paths are rooted through the import result"
    );
    let asset_path = imported
        .root
        .join(&imported.asset("asset-ref").expect("asset").relative_path);
    assert_eq!(fs::read(asset_path).expect("asset bytes"), vec![0, 1, 2, 3]);
    assert!(events
        .iter()
        .any(|event| event.phase == portable::ProgressPhase::Extract));

    let second_destination = temp_path("round-trip");
    let resources = imported.resource_exports();
    let mut package = PortablePackage::new(imported.manifest.clone(), imported.workspace.clone());
    for resource in resources {
        package.push_resource(resource);
    }
    let token = CancellationToken::new();
    let mut control = OperationControl::new(&token);
    let writer = export_portable(Vec::new(), &package, &Default::default(), &mut control)
        .expect("second export starts");
    let second_bytes = writer.finish().expect("second export finishes");
    let mut control = OperationControl::new(&token);
    let second = import_portable(
        Cursor::new(second_bytes),
        &second_destination,
        &Default::default(),
        &mut control,
    )
    .expect("second import");
    assert_eq!(
        second
            .workspace
            .get("x-workspace-plugin")
            .and_then(|value| value.get("schema"))
            .and_then(JsonValue::as_str),
        Some("e03.fixture.v1")
    );
    assert_eq!(
        fs::read(
            second.root.join(
                &second
                    .file("objects/image-ref/content.png")
                    .expect("image resource")
                    .relative_path,
            )
        )
        .expect("binary resource"),
        vec![0, 1, 2, 3]
    );

    clean(&destination);
    clean(&second_destination);
}

#[test]
fn csv_links_and_addresses_are_preserved_without_scanning_metadata() {
    let rows = vec![
        vec!["A, value".to_owned(), "plain".to_owned()],
        vec!["line\nbreak".to_owned(), "résumé".to_owned()],
    ];
    let encoded = stringify_csv(&rows);
    assert_eq!(parse_csv(encoded.as_bytes()).expect("CSV parse"), rows);
    assert_eq!(cell_address(0, 0), "A1");
    assert_eq!(cell_address(6, 27), "AB7");
    assert_eq!(coordinates_from_address("ab7"), Some((6, 27)));
    let link = create_tactile_link("markdown", "doc-1", "Plan | notes ] v2");
    let parsed = parse_tactile_link(&link).expect("Tactile link");
    assert_eq!(parsed.object_id, "doc-1");
    assert_eq!(parsed.title, "Plan | notes ] v2");
}

#[test]
fn malformed_and_oversized_packages_fail_before_destination_creation() {
    let bytes = export_fixture();
    let limits = portable::PortableLimits {
        max_entries: 1,
        ..portable::PortableLimits::default()
    };
    let destination = temp_path("oversized");
    let token = CancellationToken::new();
    let mut control = OperationControl::new(&token);
    let error = import_portable(
        Cursor::new(bytes),
        &destination,
        &PortableImportOptions { limits },
        &mut control,
    )
    .expect_err("entry count must be rejected");
    assert_eq!(error.code_kind(), PortableErrorCode::ZipLimit);
    assert!(!destination.exists());

    let destination = temp_path("malformed");
    let error = parse_json(br#"{"version":4,"objects":null}"#)
        .and_then(|workspace| {
            portable::validate_portable_workspace(&workspace, &ValidationOptions::default())
        })
        .expect_err("malformed object collection");
    assert_eq!(error.code_kind(), PortableErrorCode::MalformedObjects);
    assert!(!destination.exists());
}

fn decode_base64(value: &str) -> Vec<u8> {
    let mut output = Vec::new();
    let mut accumulator = 0u32;
    let mut bits = 0u8;
    for byte in value.bytes() {
        let digit = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            b'=' => break,
            _ => continue,
        };
        accumulator = (accumulator << 6) | u32::from(digit);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            output.push((accumulator >> bits) as u8);
            accumulator &= (1 << bits) - 1;
        }
    }
    output
}

#[test]
fn deflated_zip_entries_stream_through_the_same_boundary() {
    let bytes = decode_base64(
        "UEsDBBQAAAAIALUIDl1GAqKeEgAAAGgAAAALAAAAcGF5bG9hZC50eHTLSM3JyVdISU3LSSxJzaAdBwBQSwECFAAUAAAACAC1CA5dRgKinhIAAABoAAAACwAAAAAAAAAAAAAAgAEAAAAAcGF5bG9hZC50eHRQSwUGAAAAAAEAAQA5AAAAOwAAAAAA",
    );
    let token = CancellationToken::new();
    let mut control = OperationControl::new(&token);
    let mut archive =
        portable::ZipArchive::open(Cursor::new(bytes), Default::default()).expect("deflated ZIP");
    let decoded = archive
        .read_entry_bytes("payload.txt", &mut control)
        .expect("deflated entry");
    assert_eq!(decoded, b"hello deflate".repeat(8));
}

#[test]
fn asset_store_streams_native_handles_and_cleans_cancelled_writes() {
    let root = temp_path("assets");
    let store = AssetStore::with_limits(
        &root,
        assets::AssetStoreLimits {
            max_asset_bytes: 256 * 1024,
        },
    );
    let bytes = vec![0x5a; 128 * 1024];
    let token = CancellationToken::new();
    let mut progress_count = 0u32;
    let mut sink = |_: ProgressEvent| progress_count += 1;
    let mut control = OperationControl::with_progress(&token, &mut sink);
    let handle = store
        .write_stream(
            &AssetWriteRequest {
                id: "asset-stream".to_owned(),
                file_name: "payload.bin".to_owned(),
                mime: Some("application/octet-stream".to_owned()),
                expected_size: Some(bytes.len() as u64),
            },
            Cursor::new(bytes.clone()),
            &mut control,
        )
        .expect("asset write");
    assert!(handle
        .path
        .ends_with(Path::new("assets/asset-stream/payload.bin")));
    assert!(progress_count > 0);
    let mut copied = Vec::new();
    let token = CancellationToken::new();
    let mut control = OperationControl::new(&token);
    assert_eq!(
        store
            .stream_to(&handle, &mut copied, &mut control)
            .expect("asset read"),
        bytes.len() as u64
    );
    assert_eq!(copied, bytes);

    let cancelled_root = temp_path("cancelled-assets");
    let cancelled_store = AssetStore::with_limits(
        &cancelled_root,
        assets::AssetStoreLimits {
            max_asset_bytes: 256 * 1024,
        },
    );
    let token = CancellationToken::new();
    let callback_token = token.clone();
    let mut sink = move |_: ProgressEvent| callback_token.cancel();
    let mut control = OperationControl::with_progress(&token, &mut sink);
    let error = cancelled_store
        .write_stream(
            &AssetWriteRequest {
                id: "cancelled".to_owned(),
                file_name: "payload.bin".to_owned(),
                mime: None,
                expected_size: Some(bytes.len() as u64),
            },
            Cursor::new(bytes),
            &mut control,
        )
        .expect_err("cancelled asset write");
    assert_eq!(error.code_kind(), PortableErrorCode::Cancelled);
    assert!(!cancelled_root.join("assets/cancelled/payload.bin").exists());

    clean(&root);
    clean(&cancelled_root);
}
