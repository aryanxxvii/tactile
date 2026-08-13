//! A small, dependency-free JSON value and codec used at the native boundary.
//!
//! Tactile's portable files deliberately keep unknown fields.  The native
//! crate cannot depend on the frontend's JavaScript serializer, so this codec
//! keeps object members in a map and keeps the source spelling of numbers.
//! It is intentionally a data codec, not a schema or a UI model.

use std::collections::BTreeMap;
use std::fmt;

use super::{PortableError, PortableResult};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum JsonValue {
    Null,
    Bool(bool),
    Number(String),
    String(String),
    Array(Vec<JsonValue>),
    Object(BTreeMap<String, JsonValue>),
}

impl JsonValue {
    pub fn object() -> Self {
        Self::Object(BTreeMap::new())
    }

    pub fn array() -> Self {
        Self::Array(Vec::new())
    }

    pub fn get(&self, key: &str) -> Option<&Self> {
        match self {
            Self::Object(values) => values.get(key),
            _ => None,
        }
    }

    pub fn get_mut(&mut self, key: &str) -> Option<&mut Self> {
        match self {
            Self::Object(values) => values.get_mut(key),
            _ => None,
        }
    }

    pub fn object_value(&self) -> Option<&BTreeMap<String, JsonValue>> {
        match self {
            Self::Object(values) => Some(values),
            _ => None,
        }
    }

    pub fn object_value_mut(&mut self) -> Option<&mut BTreeMap<String, JsonValue>> {
        match self {
            Self::Object(values) => Some(values),
            _ => None,
        }
    }

    pub fn array_value(&self) -> Option<&[JsonValue]> {
        match self {
            Self::Array(values) => Some(values),
            _ => None,
        }
    }

    pub fn array_value_mut(&mut self) -> Option<&mut Vec<JsonValue>> {
        match self {
            Self::Array(values) => Some(values),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Self::String(value) => Some(value),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            Self::Bool(value) => Some(*value),
            _ => None,
        }
    }

    pub fn as_u64(&self) -> Option<u64> {
        match self {
            Self::Number(value) => value.parse().ok(),
            _ => None,
        }
    }

    pub fn as_i64(&self) -> Option<i64> {
        match self {
            Self::Number(value) => value.parse().ok(),
            _ => None,
        }
    }

    pub fn is_null(&self) -> bool {
        matches!(self, Self::Null)
    }

    pub fn insert(&mut self, key: impl Into<String>, value: JsonValue) -> Option<JsonValue> {
        match self {
            Self::Object(values) => values.insert(key.into(), value),
            _ => None,
        }
    }

    pub fn push(&mut self, value: JsonValue) -> bool {
        match self {
            Self::Array(values) => {
                values.push(value);
                true
            }
            _ => false,
        }
    }

    pub fn into_object(self) -> Option<BTreeMap<String, JsonValue>> {
        match self {
            Self::Object(values) => Some(values),
            _ => None,
        }
    }
}

impl From<bool> for JsonValue {
    fn from(value: bool) -> Self {
        Self::Bool(value)
    }
}

impl From<String> for JsonValue {
    fn from(value: String) -> Self {
        Self::String(value)
    }
}

impl From<&str> for JsonValue {
    fn from(value: &str) -> Self {
        Self::String(value.to_owned())
    }
}

impl From<u64> for JsonValue {
    fn from(value: u64) -> Self {
        Self::Number(value.to_string())
    }
}

impl From<usize> for JsonValue {
    fn from(value: usize) -> Self {
        Self::Number(value.to_string())
    }
}

impl From<i64> for JsonValue {
    fn from(value: i64) -> Self {
        Self::Number(value.to_string())
    }
}

impl fmt::Display for JsonValue {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let bytes = stringify_json(self, false).map_err(|_| fmt::Error)?;
        let text = String::from_utf8(bytes).map_err(|_| fmt::Error)?;
        formatter.write_str(&text)
    }
}

pub fn parse_json(bytes: &[u8]) -> PortableResult<JsonValue> {
    let mut parser = Parser { bytes, index: 0 };
    let value = parser.parse_value()?;
    parser.skip_whitespace();
    if parser.index != bytes.len() {
        return Err(PortableError::malformed_json(
            "trailing characters after the JSON value",
        ));
    }
    Ok(value)
}

pub fn stringify_json(value: &JsonValue, pretty: bool) -> PortableResult<Vec<u8>> {
    let mut output = Vec::new();
    write_json(&mut output, value, pretty, 0)?;
    Ok(output)
}

pub fn write_json<W: std::io::Write>(
    writer: &mut W,
    value: &JsonValue,
    pretty: bool,
    depth: usize,
) -> PortableResult<()> {
    match value {
        JsonValue::Null => writer.write_all(b"null").map_err(PortableError::from),
        JsonValue::Bool(true) => writer.write_all(b"true").map_err(PortableError::from),
        JsonValue::Bool(false) => writer.write_all(b"false").map_err(PortableError::from),
        JsonValue::Number(number) => writer.write_all(number.as_bytes()).map_err(PortableError::from),
        JsonValue::String(string) => write_json_string(writer, string),
        JsonValue::Array(values) => {
            writer.write_all(b"[").map_err(PortableError::from)?;
            for (index, child) in values.iter().enumerate() {
                if index > 0 {
                    writer.write_all(b",").map_err(PortableError::from)?;
                }
                if pretty {
                    write_indent(writer, depth + 1)?;
                }
                write_json(writer, child, pretty, depth + 1)?;
            }
            if pretty && !values.is_empty() {
                write_indent(writer, depth)?;
            }
            writer.write_all(b"]").map_err(PortableError::from)
        }
        JsonValue::Object(values) => {
            writer.write_all(b"{").map_err(PortableError::from)?;
            for (index, (key, child)) in values.iter().enumerate() {
                if index > 0 {
                    writer.write_all(b",").map_err(PortableError::from)?;
                }
                if pretty {
                    write_indent(writer, depth + 1)?;
                }
                write_json_string(writer, key)?;
                writer.write_all(if pretty { b": " } else { b":" })
                    .map_err(PortableError::from)?;
                write_json(writer, child, pretty, depth + 1)?;
            }
            if pretty && !values.is_empty() {
                write_indent(writer, depth)?;
            }
            writer.write_all(b"}").map_err(PortableError::from)
        }
    }
}

fn write_indent<W: std::io::Write>(writer: &mut W, depth: usize) -> PortableResult<()> {
    writer.write_all(b"\n").map_err(PortableError::from)?;
    for _ in 0..depth {
        writer.write_all(b"  ").map_err(PortableError::from)?;
    }
    Ok(())
}

fn write_json_string<W: std::io::Write>(writer: &mut W, value: &str) -> PortableResult<()> {
    writer.write_all(b"\"").map_err(PortableError::from)?;
    for character in value.chars() {
        match character {
            '"' => writer.write_all(b"\\\"").map_err(PortableError::from)?,
            '\\' => writer.write_all(b"\\\\").map_err(PortableError::from)?,
            '\u{08}' => writer.write_all(b"\\b").map_err(PortableError::from)?,
            '\u{0c}' => writer.write_all(b"\\f").map_err(PortableError::from)?,
            '\n' => writer.write_all(b"\\n").map_err(PortableError::from)?,
            '\r' => writer.write_all(b"\\r").map_err(PortableError::from)?,
            '\t' => writer.write_all(b"\\t").map_err(PortableError::from)?,
            character if character <= '\u{1f}' => {
                let escape = format!("\\u{:04x}", character as u32);
                writer.write_all(escape.as_bytes()).map_err(PortableError::from)?;
            }
            character => {
                let mut encoded = [0u8; 4];
                writer
                    .write_all(character.encode_utf8(&mut encoded).as_bytes())
                    .map_err(PortableError::from)?;
            }
        }
    }
    writer.write_all(b"\"").map_err(PortableError::from)
}

struct Parser<'a> {
    bytes: &'a [u8],
    index: usize,
}

impl<'a> Parser<'a> {
    fn parse_value(&mut self) -> PortableResult<JsonValue> {
        self.skip_whitespace();
        let Some(&byte) = self.bytes.get(self.index) else {
            return Err(PortableError::malformed_json("unexpected end of input"));
        };
        match byte {
            b'n' => {
                self.expect_bytes(b"null")?;
                Ok(JsonValue::Null)
            }
            b't' => {
                self.expect_bytes(b"true")?;
                Ok(JsonValue::Bool(true))
            }
            b'f' => {
                self.expect_bytes(b"false")?;
                Ok(JsonValue::Bool(false))
            }
            b'"' => Ok(JsonValue::String(self.parse_string()?)),
            b'[' => self.parse_array(),
            b'{' => self.parse_object(),
            b'-' | b'0'..=b'9' => Ok(JsonValue::Number(self.parse_number()?)),
            _ => Err(PortableError::malformed_json("unexpected JSON token")),
        }
    }

    fn parse_array(&mut self) -> PortableResult<JsonValue> {
        self.index += 1;
        let mut values = Vec::new();
        self.skip_whitespace();
        if self.take_if(b']') {
            return Ok(JsonValue::Array(values));
        }
        loop {
            values.push(self.parse_value()?);
            self.skip_whitespace();
            if self.take_if(b']') {
                break;
            }
            if !self.take_if(b',') {
                return Err(PortableError::malformed_json(
                    "expected a comma or closing array bracket",
                ));
            }
        }
        Ok(JsonValue::Array(values))
    }

    fn parse_object(&mut self) -> PortableResult<JsonValue> {
        self.index += 1;
        let mut values = BTreeMap::new();
        self.skip_whitespace();
        if self.take_if(b'}') {
            return Ok(JsonValue::Object(values));
        }
        loop {
            self.skip_whitespace();
            if self.bytes.get(self.index) != Some(&b'"') {
                return Err(PortableError::malformed_json(
                    "object keys must be JSON strings",
                ));
            }
            let key = self.parse_string()?;
            self.skip_whitespace();
            if !self.take_if(b':') {
                return Err(PortableError::malformed_json(
                    "expected a colon after an object key",
                ));
            }
            let value = self.parse_value()?;
            values.insert(key, value);
            self.skip_whitespace();
            if self.take_if(b'}') {
                break;
            }
            if !self.take_if(b',') {
                return Err(PortableError::malformed_json(
                    "expected a comma or closing object brace",
                ));
            }
        }
        Ok(JsonValue::Object(values))
    }

    fn parse_string(&mut self) -> PortableResult<String> {
        if !self.take_if(b'"') {
            return Err(PortableError::malformed_json("expected a JSON string"));
        }
        let mut output = Vec::new();
        loop {
            let Some(&byte) = self.bytes.get(self.index) else {
                return Err(PortableError::malformed_json("unterminated JSON string"));
            };
            self.index += 1;
            match byte {
                b'"' => return String::from_utf8(output).map_err(|_| {
                    PortableError::malformed_json("JSON string contains invalid UTF-8")
                }),
                b'\\' => {
                    let Some(&escaped) = self.bytes.get(self.index) else {
                        return Err(PortableError::malformed_json("unfinished JSON escape"));
                    };
                    self.index += 1;
                    match escaped {
                        b'"' | b'\\' | b'/' => output.push(escaped),
                        b'b' => output.push(0x08),
                        b'f' => output.push(0x0c),
                        b'n' => output.push(b'\n'),
                        b'r' => output.push(b'\r'),
                        b't' => output.push(b'\t'),
                        b'u' => self.push_unicode_escape(&mut output)?,
                        _ => return Err(PortableError::malformed_json("invalid JSON escape")),
                    }
                }
                byte if byte < 0x20 => {
                    return Err(PortableError::malformed_json(
                        "JSON strings cannot contain control characters",
                    ));
                }
                byte => output.push(byte),
            }
        }
    }

    fn push_unicode_escape(&mut self, output: &mut Vec<u8>) -> PortableResult<()> {
        let first = self.read_hex_quad()?;
        let codepoint = if (0xd800..=0xdbff).contains(&first) {
            if self.bytes.get(self.index) != Some(&b'\\')
                || self.bytes.get(self.index + 1) != Some(&b'u')
            {
                return Err(PortableError::malformed_json(
                    "a high surrogate must be followed by a low surrogate",
                ));
            }
            self.index += 2;
            let second = self.read_hex_quad()?;
            if !(0xdc00..=0xdfff).contains(&second) {
                return Err(PortableError::malformed_json("invalid low surrogate"));
            }
            0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00)
        } else if (0xdc00..=0xdfff).contains(&first) {
            return Err(PortableError::malformed_json("unexpected low surrogate"));
        } else {
            first
        };
        let character = char::from_u32(codepoint)
            .ok_or_else(|| PortableError::malformed_json("invalid Unicode code point"))?;
        let mut encoded = [0u8; 4];
        output.extend_from_slice(character.encode_utf8(&mut encoded).as_bytes());
        Ok(())
    }

    fn read_hex_quad(&mut self) -> PortableResult<u32> {
        if self.index + 4 > self.bytes.len() {
            return Err(PortableError::malformed_json("short Unicode escape"));
        }
        let mut value = 0u32;
        for _ in 0..4 {
            let byte = self.bytes[self.index];
            self.index += 1;
            let digit = match byte {
                b'0'..=b'9' => u32::from(byte - b'0'),
                b'a'..=b'f' => u32::from(byte - b'a' + 10),
                b'A'..=b'F' => u32::from(byte - b'A' + 10),
                _ => return Err(PortableError::malformed_json("invalid Unicode escape")),
            };
            value = (value << 4) | digit;
        }
        Ok(value)
    }

    fn parse_number(&mut self) -> PortableResult<String> {
        let start = self.index;
        self.take_if(b'-');
        match self.bytes.get(self.index) {
            Some(b'0') => {
                self.index += 1;
            }
            Some(b'1'..=b'9') => {
                self.index += 1;
                while matches!(self.bytes.get(self.index), Some(b'0'..=b'9')) {
                    self.index += 1;
                }
            }
            _ => return Err(PortableError::malformed_json("invalid JSON number")),
        }
        if self.take_if(b'.') {
            let fraction_start = self.index;
            while matches!(self.bytes.get(self.index), Some(b'0'..=b'9')) {
                self.index += 1;
            }
            if fraction_start == self.index {
                return Err(PortableError::malformed_json("JSON fraction has no digits"));
            }
        }
        if matches!(self.bytes.get(self.index), Some(b'e' | b'E')) {
            self.index += 1;
            self.take_if(b'+');
            self.take_if(b'-');
            let exponent_start = self.index;
            while matches!(self.bytes.get(self.index), Some(b'0'..=b'9')) {
                self.index += 1;
            }
            if exponent_start == self.index {
                return Err(PortableError::malformed_json("JSON exponent has no digits"));
            }
        }
        Ok(String::from_utf8(self.bytes[start..self.index].to_vec()).expect("number is ASCII"))
    }

    fn expect_bytes(&mut self, expected: &[u8]) -> PortableResult<()> {
        if self.bytes.get(self.index..self.index + expected.len()) != Some(expected) {
            return Err(PortableError::malformed_json("invalid JSON literal"));
        }
        self.index += expected.len();
        Ok(())
    }

    fn skip_whitespace(&mut self) {
        while matches!(self.bytes.get(self.index), Some(b' ' | b'\n' | b'\r' | b'\t')) {
            self.index += 1;
        }
    }

    fn take_if(&mut self, expected: u8) -> bool {
        if self.bytes.get(self.index) == Some(&expected) {
            self.index += 1;
            true
        } else {
            false
        }
    }
}
