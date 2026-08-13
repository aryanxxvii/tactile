use std::io::Read;

use super::{
    OperationControl, PortableError, PortableErrorCode, PortableResult, ProgressEvent,
    ProgressPhase, TactileLink,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CsvCell {
    pub row: u64,
    pub column: u64,
    pub address: String,
    pub value: String,
}

pub fn cell_address(row: u64, column: u64) -> String {
    let mut column = column + 1;
    let mut letters = Vec::new();
    while column > 0 {
        let remainder = (column - 1) % 26;
        letters.push((b'A' + remainder as u8) as char);
        column = (column - 1) / 26;
    }
    letters.iter().rev().collect::<String>() + &(row + 1).to_string()
}

pub fn coordinates_from_address(address: &str) -> Option<(u64, u64)> {
    let trimmed = address.trim();
    if trimmed.is_empty() {
        return None;
    }
    let mut split = 0usize;
    for (index, character) in trimmed.char_indices() {
        if character.is_ascii_digit() {
            split = index;
            break;
        }
        if !character.is_ascii_alphabetic() {
            return None;
        }
    }
    if split == 0 {
        return None;
    }
    let (letters, digits) = trimmed.split_at(split);
    if digits.is_empty() || !digits.chars().all(|character| character.is_ascii_digit()) {
        return None;
    }
    let row = digits.parse::<u64>().ok()?.checked_sub(1)?;
    let mut column = 0u64;
    for character in letters.bytes() {
        let upper = character.to_ascii_uppercase();
        if !upper.is_ascii_uppercase() {
            return None;
        }
        column = column.checked_mul(26)?.checked_add(u64::from(upper - b'A' + 1))?;
    }
    column.checked_sub(1).map(|column| (row, column))
}

pub fn encode_csv_field(value: &str) -> String {
    let needs_quotes = value.contains(',')
        || value.contains('\r')
        || value.contains('\n')
        || value.chars().next().is_some_and(char::is_whitespace)
        || value.chars().next_back().is_some_and(char::is_whitespace);
    if needs_quotes {
        format!("\"{}\"", value.replace('\"', "\"\""))
    } else {
        value.to_owned()
    }
}

pub fn stringify_csv(rows: &[Vec<String>]) -> String {
    rows.iter()
        .map(|row| {
            row.iter()
                .map(|value| encode_csv_field(value))
                .collect::<Vec<_>>()
                .join(",")
        })
        .collect::<Vec<_>>()
        .join("\r\n")
}

pub fn parse_csv(bytes: &[u8]) -> PortableResult<Vec<Vec<String>>> {
    let cancellation = super::CancellationToken::new();
    let mut control = OperationControl::new(&cancellation);
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut current_row = Vec::new();
    let mut current_row_number = 0u64;
    let mut current_column_number = 0u64;
    stream_csv_cells(bytes, &mut control, |cell| {
        if cell.row != current_row_number {
            rows.push(std::mem::take(&mut current_row));
            current_row_number = cell.row;
            current_column_number = 0;
        }
        debug_assert_eq!(cell.column, current_column_number);
        current_row.push(cell.value);
        current_column_number = current_column_number.saturating_add(1);
        Ok(())
    })?;
    if !current_row.is_empty() {
        rows.push(current_row);
    }
    Ok(rows)
}

pub fn stream_csv_cells<R: Read, F>(
    mut reader: R,
    control: &mut OperationControl<'_>,
    mut callback: F,
) -> PortableResult<()>
where
    F: FnMut(CsvCell) -> PortableResult<()>,
{
    let mut buffer = [0u8; 64 * 1024];
    let mut field = Vec::new();
    let mut row = 0u64;
    let mut column = 0u64;
    let mut saw_any = false;
    let mut in_quotes = false;
    let mut after_quote = false;
    let mut at_field_start = true;
    let mut pending_cr = false;
    let mut bytes_completed = 0u64;

    let mut finish_field = |field: &mut Vec<u8>, row: u64, column: u64| -> PortableResult<()> {
        let value = String::from_utf8(std::mem::take(field)).map_err(|_| {
            PortableError::new(
                PortableErrorCode::MalformedPackage,
                "CSV contains invalid UTF-8",
            )
        })?;
        callback(CsvCell {
            row,
            column,
            address: cell_address(row, column),
            value,
        })
    };

    loop {
        control.check()?;
        let read = reader.read(&mut buffer).map_err(PortableError::from)?;
        if read == 0 {
            break;
        }
        bytes_completed = bytes_completed.saturating_add(read as u64);
        for &byte in &buffer[..read] {
            saw_any = true;
            if pending_cr {
                pending_cr = false;
                if byte == b'\n' {
                    continue;
                }
            }
            if in_quotes {
                if after_quote {
                    after_quote = false;
                    if byte == b'"' {
                        field.push(b'"');
                        continue;
                    }
                    if byte == b',' {
                        finish_field(&mut field, row, column)?;
                        column = column.saturating_add(1);
                        at_field_start = true;
                        in_quotes = false;
                        continue;
                    }
                    if byte == b'\r' || byte == b'\n' {
                        finish_field(&mut field, row, column)?;
                        row = row.saturating_add(1);
                        column = 0;
                        at_field_start = true;
                        in_quotes = false;
                        pending_cr = byte == b'\r';
                        continue;
                    }
                    return Err(PortableError::new(
                        PortableErrorCode::MalformedPackage,
                        "CSV has characters after a closing quote",
                    ));
                }
                if byte == b'\"' {
                    after_quote = true;
                } else {
                    field.push(byte);
                }
                continue;
            }
            if at_field_start && byte == b'\"' {
                in_quotes = true;
                at_field_start = false;
                continue;
            }
            if byte == b',' {
                finish_field(&mut field, row, column)?;
                column = column.saturating_add(1);
                at_field_start = true;
            } else if byte == b'\r' || byte == b'\n' {
                finish_field(&mut field, row, column)?;
                row = row.saturating_add(1);
                column = 0;
                at_field_start = true;
                pending_cr = byte == b'\r';
            } else {
                field.push(byte);
                at_field_start = false;
            }
        }
        control.report(ProgressEvent {
            phase: ProgressPhase::Read,
            entries_completed: 0,
            entries_total: 0,
            bytes_completed,
            bytes_total: 0,
        })?;
    }

    if in_quotes {
        if after_quote {
            finish_field(&mut field, row, column)?;
        } else {
            return Err(PortableError::new(
                PortableErrorCode::MalformedPackage,
                "CSV has an unterminated quoted field",
            ));
        }
    } else if saw_any && (!field.is_empty() || !at_field_start || column > 0) {
        finish_field(&mut field, row, column)?;
    }
    Ok(())
}

pub fn create_tactile_link(object_type: &str, object_id: &str, title: &str) -> String {
    format!(
        "[[tactile:{object_type}:{object_id}|{}]]",
        escape_link_title(title)
    )
}

pub fn parse_tactile_link(value: &str) -> Option<TactileLink> {
    if !value.starts_with("[[tactile:") || !value.ends_with("]]") {
        return None;
    }
    let body = &value[10..value.len() - 2];
    let separator = body.find(':')?;
    if separator == 0 {
        return None;
    }
    let object_type = &body[..separator];
    let link_body = &body[separator + 1..];
    let pipe = first_unescaped_pipe(link_body)?;
    if pipe == 0 {
        return None;
    }
    Some(TactileLink {
        object_type: object_type.to_owned(),
        object_id: link_body[..pipe].to_owned(),
        title: unescape_link_title(&link_body[pipe + 1..]),
    })
}

fn escape_link_title(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('|', "\\|")
        .replace(']', "\\]")
}

fn unescape_link_title(value: &str) -> String {
    let mut output = String::new();
    let mut escaped = false;
    for character in value.chars() {
        if escaped {
            output.push(character);
            escaped = false;
        } else if character == '\\' {
            escaped = true;
        } else {
            output.push(character);
        }
    }
    if escaped {
        output.push('\\');
    }
    output
}

fn first_unescaped_pipe(value: &str) -> Option<usize> {
    let mut escaped = false;
    for (index, character) in value.char_indices() {
        if escaped {
            escaped = false;
        } else if character == '\\' {
            escaped = true;
        } else if character == '|' {
            return Some(index);
        }
    }
    None
}
