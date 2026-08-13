use std::collections::BTreeMap;
use std::io::{Read, Seek, SeekFrom, Write};

use super::{
    parse_json, OperationControl, PortableError, PortableErrorCode, PortableLimits, PortableResult,
    ProgressEvent, ProgressPhase,
};

const LOCAL_FILE_SIGNATURE: u32 = 0x0403_4b50;
const CENTRAL_FILE_SIGNATURE: u32 = 0x0201_4b50;
const END_OF_CENTRAL_SIGNATURE: u32 = 0x0605_4b50;
const DATA_DESCRIPTOR_SIGNATURE: u32 = 0x0807_4b50;
const ZIP64_SENTINEL_16: u16 = 0xffff;
const ZIP64_SENTINEL_32: u32 = 0xffff_ffff;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ZipCompression {
    Stored,
    Deflated,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ZipEntryInfo {
    pub path: String,
    pub compressed_size: u64,
    pub uncompressed_size: u64,
    pub crc32: u32,
    pub compression: ZipCompression,
    pub is_directory: bool,
    pub flags: u16,
    data_offset: u64,
    local_header_offset: u64,
}

pub struct ZipArchive<R> {
    reader: R,
    entries: Vec<ZipEntryInfo>,
    by_path: BTreeMap<String, usize>,
    total_uncompressed_bytes: u64,
    limits: PortableLimits,
}

impl<R: Read + Seek> ZipArchive<R> {
    pub fn open(mut reader: R, limits: PortableLimits) -> PortableResult<Self> {
        let file_length = reader.seek(SeekFrom::End(0)).map_err(PortableError::from)?;
        let tail_length = file_length.min(22 + 65_535);
        reader
            .seek(SeekFrom::Start(file_length.saturating_sub(tail_length)))
            .map_err(PortableError::from)?;
        let mut tail = vec![0u8; tail_length as usize];
        reader.read_exact(&mut tail).map_err(PortableError::from)?;

        let eocd_offset = find_signature_from_end(&tail, END_OF_CENTRAL_SIGNATURE)
            .ok_or_else(|| PortableError::new(PortableErrorCode::ZipSignature, "ZIP end record is missing"))?;
        if eocd_offset + 22 > tail.len() {
            return Err(PortableError::new(
                PortableErrorCode::ZipSignature,
                "ZIP end record is truncated",
            ));
        }
        let disk_number = read_u16(&tail, eocd_offset + 4)?;
        let central_disk = read_u16(&tail, eocd_offset + 6)?;
        let entries_on_disk = read_u16(&tail, eocd_offset + 8)?;
        let entry_count = read_u16(&tail, eocd_offset + 10)?;
        let central_size = u64::from(read_u32(&tail, eocd_offset + 12)?);
        let central_offset = u64::from(read_u32(&tail, eocd_offset + 16)?);
        if disk_number != 0 || central_disk != 0 || entries_on_disk != entry_count {
            return Err(PortableError::new(
                PortableErrorCode::ZipUnsupported,
                "multi-disk ZIP archives are not supported",
            ));
        }
        if entry_count == ZIP64_SENTINEL_16
            || central_size == u64::from(ZIP64_SENTINEL_32)
            || central_offset == u64::from(ZIP64_SENTINEL_32)
        {
            return Err(PortableError::new(
                PortableErrorCode::ZipUnsupported,
                "ZIP64 archives are outside the portable v4 boundary",
            ));
        }
        if u64::from(entry_count) > limits.max_entries {
            return Err(PortableError::new(
                PortableErrorCode::ZipLimit,
                "ZIP entry count exceeds the portable limit",
            ));
        }
        let central_end = central_offset.checked_add(central_size).ok_or_else(|| {
            PortableError::new(PortableErrorCode::ZipLimit, "ZIP central directory size overflows")
        })?;
        if central_end > file_length {
            return Err(PortableError::new(
                PortableErrorCode::ZipSignature,
                "ZIP central directory lies outside the file",
            ));
        }

        reader
            .seek(SeekFrom::Start(central_offset))
            .map_err(PortableError::from)?;
        let mut entries = Vec::with_capacity(entry_count as usize);
        let mut by_path = BTreeMap::new();
        let mut total_uncompressed_bytes = 0u64;
        for _ in 0..entry_count {
            let mut header = [0u8; 46];
            reader.read_exact(&mut header).map_err(PortableError::from)?;
            if read_u32(&header, 0)? != CENTRAL_FILE_SIGNATURE {
                return Err(PortableError::new(
                    PortableErrorCode::ZipSignature,
                    "ZIP central directory entry has an invalid signature",
                ));
            }
            let flags = read_u16(&header, 8)?;
            if flags & 0x0001 != 0 {
                return Err(PortableError::new(
                    PortableErrorCode::ZipUnsupported,
                    "encrypted ZIP entries are not supported",
                ));
            }
            let compression = match read_u16(&header, 10)? {
                0 => ZipCompression::Stored,
                8 => ZipCompression::Deflated,
                method => {
                    return Err(PortableError::new(
                        PortableErrorCode::ZipUnsupported,
                        format!("ZIP compression method {method} is not supported"),
                    ));
                }
            };
            let crc32 = read_u32(&header, 16)?;
            let compressed_size = u64::from(read_u32(&header, 20)?);
            let uncompressed_size = u64::from(read_u32(&header, 24)?);
            let name_length = usize::from(read_u16(&header, 28)?);
            let extra_length = usize::from(read_u16(&header, 30)?);
            let comment_length = usize::from(read_u16(&header, 32)?);
            let external_attributes = read_u32(&header, 38)?;
            let local_header_offset = u64::from(read_u32(&header, 42)?);
            if compressed_size > limits.max_entry_compressed_bytes
                || uncompressed_size > limits.max_entry_uncompressed_bytes
            {
                return Err(PortableError::new(
                    PortableErrorCode::ZipLimit,
                    "ZIP entry exceeds the per-entry size limit",
                ));
            }
            if compressed_size == 0 && uncompressed_size > 0 {
                return Err(PortableError::new(
                    PortableErrorCode::ZipLimit,
                    "ZIP entry declares data without a compressed payload",
                ));
            }
            if compressed_size > 0
                && uncompressed_size / compressed_size.max(1) > limits.max_compression_ratio
            {
                return Err(PortableError::new(
                    PortableErrorCode::ZipLimit,
                    "ZIP compression ratio exceeds the portable limit",
                ));
            }
            let mut name = vec![0u8; name_length];
            reader.read_exact(&mut name).map_err(PortableError::from)?;
            let mut extra = vec![0u8; extra_length];
            reader.read_exact(&mut extra).map_err(PortableError::from)?;
            let mut comment = vec![0u8; comment_length];
            reader.read_exact(&mut comment).map_err(PortableError::from)?;
            let path = String::from_utf8(name).map_err(|_| {
                PortableError::new(
                    PortableErrorCode::InvalidPath,
                    "ZIP entry path is not valid UTF-8",
                )
            })?;
            let is_directory = path.ends_with('/');
            let path = super::safe_archive_path(&path, limits.max_path_bytes)?;
            if by_path.contains_key(&path) {
                return Err(PortableError::new(
                    PortableErrorCode::DuplicateEntry,
                    format!("ZIP contains duplicate path {path}"),
                ));
            }
            if external_attributes & 0xf000_0000 == 0xa000_0000
                || (external_attributes >> 16) & 0xf000 == 0xa000
            {
                return Err(PortableError::new(
                    PortableErrorCode::ZipUnsupported,
                    format!("ZIP symlink entry is not allowed: {path}"),
                ));
            }
            let next_central_offset = reader.stream_position().map_err(PortableError::from)?;
            let data_offset = local_data_offset(&mut reader, local_header_offset, flags)?;
            reader
                .seek(SeekFrom::Start(next_central_offset))
                .map_err(PortableError::from)?;
            if data_offset
                .checked_add(compressed_size)
                .map(|end| end > file_length)
                .unwrap_or(true)
            {
                return Err(PortableError::new(
                    PortableErrorCode::ZipSignature,
                    format!("ZIP entry payload lies outside the file: {path}"),
                ));
            }
            total_uncompressed_bytes = total_uncompressed_bytes
                .checked_add(uncompressed_size)
                .ok_or_else(|| PortableError::new(PortableErrorCode::ZipLimit, "ZIP size total overflows"))?;
            if total_uncompressed_bytes > limits.max_total_uncompressed_bytes {
                return Err(PortableError::new(
                    PortableErrorCode::ZipLimit,
                    "ZIP uncompressed size total exceeds the portable limit",
                ));
            }
            let index = entries.len();
            entries.push(ZipEntryInfo {
                path: path.clone(),
                compressed_size,
                uncompressed_size,
                crc32,
                compression,
                is_directory,
                flags,
                data_offset,
                local_header_offset,
            });
            by_path.insert(path, index);
        }
        if reader.stream_position().map_err(PortableError::from)? > central_end {
            return Err(PortableError::new(
                PortableErrorCode::ZipSignature,
                "ZIP central directory entry lengths exceed its declared size",
            ));
        }
        Ok(Self {
            reader,
            entries,
            by_path,
            total_uncompressed_bytes,
            limits,
        })
    }

    pub fn entries(&self) -> &[ZipEntryInfo] {
        &self.entries
    }

    pub fn entry(&self, path: &str) -> Option<&ZipEntryInfo> {
        self.by_path.get(path).and_then(|index| self.entries.get(*index))
    }

    pub fn total_uncompressed_bytes(&self) -> u64 {
        self.total_uncompressed_bytes
    }

    pub fn read_json(&mut self, path: &str, control: &mut OperationControl<'_>) -> PortableResult<super::JsonValue> {
        let bytes = self.read_entry_bytes(path, control)?;
        parse_json(&bytes)
    }

    pub fn read_entry_bytes(
        &mut self,
        path: &str,
        control: &mut OperationControl<'_>,
    ) -> PortableResult<Vec<u8>> {
        let index = *self.by_path.get(path).ok_or_else(|| {
            PortableError::new(
                PortableErrorCode::MissingEntry,
                format!("ZIP entry is missing: {path}"),
            )
        })?;
        let entry = self.entries[index].clone();
        if entry.uncompressed_size > usize::MAX as u64 {
            return Err(PortableError::new(
                PortableErrorCode::ZipLimit,
                "ZIP entry is too large for an in-memory metadata read",
            ));
        }
        let mut bytes = Vec::with_capacity(entry.uncompressed_size as usize);
        self.extract_entry_to(index, &mut bytes, control)?;
        Ok(bytes)
    }

    pub fn extract_entry_to<W: Write>(
        &mut self,
        index: usize,
        writer: &mut W,
        control: &mut OperationControl<'_>,
    ) -> PortableResult<()> {
        control.check()?;
        let entry = self.entries.get(index).cloned().ok_or_else(|| {
            PortableError::new(PortableErrorCode::MissingEntry, "ZIP entry index is out of range")
        })?;
        if entry.is_directory {
            return Ok(());
        }
        self.reader
            .seek(SeekFrom::Start(entry.data_offset))
            .map_err(PortableError::from)?;
        let mut compressed = LimitedReader::new(&mut self.reader, entry.compressed_size);
        let mut output = EntryOutput::new(
            writer,
            entry.uncompressed_size,
            entry.crc32,
            control,
            self.limits.clone(),
        );
        match entry.compression {
            ZipCompression::Stored => {
                let mut buffer = [0u8; 64 * 1024];
                loop {
                    let read = compressed.read(&mut buffer).map_err(PortableError::from)?;
                    if read == 0 {
                        break;
                    }
                    output.write_chunk(&buffer[..read])?;
                }
            }
            ZipCompression::Deflated => inflate_stream(&mut compressed, &mut output)?,
        }
        if compressed.remaining != 0 {
            let mut sink = [0u8; 1024];
            while compressed.read(&mut sink).map_err(PortableError::from)? > 0 {}
        }
        output.finish()
    }
}

fn find_signature_from_end(bytes: &[u8], signature: u32) -> Option<usize> {
    let signature = signature.to_le_bytes();
    bytes.windows(4).rposition(|window| window == signature)
}

fn read_u16(bytes: &[u8], offset: usize) -> PortableResult<u16> {
    let slice = bytes.get(offset..offset + 2).ok_or_else(|| {
        PortableError::new(PortableErrorCode::ZipSignature, "ZIP header is truncated")
    })?;
    Ok(u16::from_le_bytes([slice[0], slice[1]]))
}

fn read_u32(bytes: &[u8], offset: usize) -> PortableResult<u32> {
    let slice = bytes.get(offset..offset + 4).ok_or_else(|| {
        PortableError::new(PortableErrorCode::ZipSignature, "ZIP header is truncated")
    })?;
    Ok(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn read_u16_from_reader<R: Read>(reader: &mut R) -> PortableResult<u16> {
    let mut bytes = [0u8; 2];
    reader.read_exact(&mut bytes).map_err(PortableError::from)?;
    Ok(u16::from_le_bytes(bytes))
}

fn read_u32_from_reader<R: Read>(reader: &mut R) -> PortableResult<u32> {
    let mut bytes = [0u8; 4];
    reader.read_exact(&mut bytes).map_err(PortableError::from)?;
    Ok(u32::from_le_bytes(bytes))
}

fn local_data_offset<R: Read + Seek>(
    reader: &mut R,
    offset: u64,
    flags: u16,
) -> PortableResult<u64> {
    reader.seek(SeekFrom::Start(offset)).map_err(PortableError::from)?;
    if read_u32_from_reader(reader)? != LOCAL_FILE_SIGNATURE {
        return Err(PortableError::new(
            PortableErrorCode::ZipSignature,
            "ZIP local header has an invalid signature",
        ));
    }
    let _version = read_u16_from_reader(reader)?;
    let local_flags = read_u16_from_reader(reader)?;
    let _method = read_u16_from_reader(reader)?;
    let _time = read_u16_from_reader(reader)?;
    let _date = read_u16_from_reader(reader)?;
    let _crc = read_u32_from_reader(reader)?;
    let _compressed = read_u32_from_reader(reader)?;
    let _uncompressed = read_u32_from_reader(reader)?;
    let name_length = u64::from(read_u16_from_reader(reader)?);
    let extra_length = u64::from(read_u16_from_reader(reader)?);
    if local_flags & 0x0001 != 0 || flags & 0x0001 != 0 {
        return Err(PortableError::new(
            PortableErrorCode::ZipUnsupported,
            "encrypted ZIP local entries are not supported",
        ));
    }
    offset
        .checked_add(30)
        .and_then(|value| value.checked_add(name_length))
        .and_then(|value| value.checked_add(extra_length))
        .ok_or_else(|| PortableError::new(PortableErrorCode::ZipLimit, "ZIP local header offset overflows"))
}

struct LimitedReader<'a, R> {
    reader: &'a mut R,
    remaining: u64,
}

impl<'a, R> LimitedReader<'a, R> {
    fn new(reader: &'a mut R, remaining: u64) -> Self {
        Self { reader, remaining }
    }
}

impl<R: Read> Read for LimitedReader<'_, R> {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        if self.remaining == 0 {
            return Ok(0);
        }
        let length = buffer.len().min(self.remaining.min(usize::MAX as u64) as usize);
        let read = self.reader.read(&mut buffer[..length])?;
        self.remaining = self.remaining.saturating_sub(read as u64);
        Ok(read)
    }
}

struct EntryOutput<'writer, 'control, 'progress, W> {
    writer: &'writer mut W,
    expected_size: u64,
    expected_crc: u32,
    written: u64,
    crc: u32,
    window: [u8; 32 * 1024],
    window_position: usize,
    pending: Vec<u8>,
    control: &'control mut OperationControl<'progress>,
    limits: PortableLimits,
}

impl<'writer, 'control, 'progress, W: Write> EntryOutput<'writer, 'control, 'progress, W> {
    fn new(
        writer: &'writer mut W,
        expected_size: u64,
        expected_crc: u32,
        control: &'control mut OperationControl<'progress>,
        limits: PortableLimits,
    ) -> Self {
        Self {
            writer,
            expected_size,
            expected_crc,
            written: 0,
            crc: 0xffff_ffff,
            window: [0; 32 * 1024],
            window_position: 0,
            pending: Vec::with_capacity(64 * 1024),
            control,
            limits,
        }
    }

    fn emit(&mut self, byte: u8) -> PortableResult<()> {
        if self.written >= self.expected_size {
            return Err(PortableError::new(
                PortableErrorCode::ZipLimit,
                "ZIP decompressor produced more data than declared",
            ));
        }
        self.window[self.window_position] = byte;
        self.window_position = (self.window_position + 1) % self.window.len();
        self.pending.push(byte);
        self.written += 1;
        self.crc = crc32_update(self.crc, &[byte]);
        if self.pending.len() >= 64 * 1024 {
            self.flush_pending()?;
        }
        Ok(())
    }

    fn byte_at_distance(&self, distance: usize) -> PortableResult<u8> {
        if distance == 0 || distance > self.window.len() || distance as u64 > self.written {
            return Err(PortableError::new(
                PortableErrorCode::ZipSignature,
                "ZIP deflate distance is outside the sliding window",
            ));
        }
        let index = (self.window_position + self.window.len() - distance) % self.window.len();
        Ok(self.window[index])
    }

    fn write_chunk(&mut self, bytes: &[u8]) -> PortableResult<()> {
        for &byte in bytes {
            self.emit(byte)?;
        }
        Ok(())
    }

    fn flush_pending(&mut self) -> PortableResult<()> {
        if self.pending.is_empty() {
            return Ok(());
        }
        self.writer
            .write_all(&self.pending)
            .map_err(PortableError::from)?;
        self.pending.clear();
        self.control.report(ProgressEvent {
            phase: ProgressPhase::Read,
            entries_completed: 0,
            entries_total: 0,
            bytes_completed: self.written,
            bytes_total: self.expected_size,
        })?;
        Ok(())
    }

    fn finish(mut self) -> PortableResult<()> {
        self.flush_pending()?;
        if self.written != self.expected_size {
            return Err(PortableError::new(
                PortableErrorCode::ZipSignature,
                format!(
                    "ZIP entry size mismatch: expected {}, decoded {}",
                    self.expected_size, self.written
                ),
            ));
        }
        let actual_crc = !self.crc;
        if actual_crc != self.expected_crc {
            return Err(PortableError::new(
                PortableErrorCode::ZipCrcMismatch,
                format!(
                    "ZIP CRC mismatch: expected {:08x}, decoded {:08x}",
                    self.expected_crc, actual_crc
                ),
            ));
        }
        if self.expected_size > self.limits.max_entry_uncompressed_bytes {
            return Err(PortableError::new(
                PortableErrorCode::ZipLimit,
                "decoded ZIP entry exceeds the per-entry limit",
            ));
        }
        Ok(())
    }
}

fn crc32_update(mut crc: u32, bytes: &[u8]) -> u32 {
    for &byte in bytes {
        crc ^= u32::from(byte);
        for _ in 0..8 {
            let mask = 0u32.wrapping_sub(crc & 1);
            crc = (crc >> 1) ^ (0xedb8_8320 & mask);
        }
    }
    crc
}

pub fn crc32(bytes: &[u8]) -> u32 {
    !crc32_update(0xffff_ffff, bytes)
}

struct BitReader<'a, R: Read> {
    reader: &'a mut R,
    bits: u64,
    bit_count: u8,
}

impl<'a, R: Read> BitReader<'a, R> {
    fn new(reader: &'a mut R) -> Self {
        Self {
            reader,
            bits: 0,
            bit_count: 0,
        }
    }

    fn read_bits(&mut self, count: u8) -> PortableResult<u32> {
        if count == 0 {
            return Ok(0);
        }
        if count > 24 {
            return Err(PortableError::new(
                PortableErrorCode::ZipUnsupported,
                "deflate bit request is outside the supported width",
            ));
        }
        while self.bit_count < count {
            let mut byte = [0u8; 1];
            self.reader.read_exact(&mut byte).map_err(PortableError::from)?;
            self.bits |= u64::from(byte[0]) << self.bit_count;
            self.bit_count += 8;
        }
        let mask = (1u64 << count) - 1;
        let value = (self.bits & mask) as u32;
        self.bits >>= count;
        self.bit_count -= count;
        Ok(value)
    }

    fn align(&mut self) {
        let discard = self.bit_count % 8;
        self.bits >>= discard;
        self.bit_count -= discard;
    }

    fn read_aligned_byte(&mut self) -> PortableResult<u8> {
        self.align();
        if self.bit_count != 0 {
            return Err(PortableError::new(
                PortableErrorCode::ZipSignature,
                "deflate bit reader failed to align",
            ));
        }
        let mut byte = [0u8; 1];
        self.reader.read_exact(&mut byte).map_err(PortableError::from)?;
        Ok(byte[0])
    }

    fn read_aligned_u16(&mut self) -> PortableResult<u16> {
        let low = u16::from(self.read_aligned_byte()?);
        let high = u16::from(self.read_aligned_byte()?);
        Ok(low | (high << 8))
    }
}

#[derive(Clone, Copy)]
struct HuffmanNode {
    child: [i32; 2],
    symbol: i32,
}

struct HuffmanTree {
    nodes: Vec<HuffmanNode>,
}

impl HuffmanTree {
    fn from_lengths(lengths: &[u8]) -> PortableResult<Self> {
        let mut counts = [0u16; 16];
        for &length in lengths {
            if length > 15 {
                return Err(PortableError::new(
                    PortableErrorCode::ZipSignature,
                    "deflate Huffman code is longer than 15 bits",
                ));
            }
            if length > 0 {
                counts[length as usize] = counts[length as usize].saturating_add(1);
            }
        }
        let mut next_code = [0u16; 16];
        let mut code = 0u16;
        for length in 1..=15 {
            code = (code + counts[length - 1]) << 1;
            next_code[length] = code;
        }
        if code.saturating_add(counts[15]) > (1u16 << 15) {
            return Err(PortableError::new(
                PortableErrorCode::ZipSignature,
                "deflate Huffman tree is over-subscribed",
            ));
        }
        let mut tree = Self {
            nodes: vec![HuffmanNode {
                child: [-1, -1],
                symbol: -1,
            }],
        };
        for (symbol, &length) in lengths.iter().enumerate() {
            if length == 0 {
                continue;
            }
            let code = next_code[length as usize];
            next_code[length as usize] = next_code[length as usize].saturating_add(1);
            let reversed = reverse_bits(code, length);
            let mut node_index = 0usize;
            for bit_index in 0..length {
                if tree.nodes[node_index].symbol >= 0 {
                    return Err(PortableError::new(
                        PortableErrorCode::ZipSignature,
                        "deflate Huffman tree has a prefix collision",
                    ));
                }
                let bit = usize::from((reversed >> bit_index) & 1);
                let child = tree.nodes[node_index].child[bit];
                if child < 0 {
                    let new_index = tree.nodes.len() as i32;
                    tree.nodes[node_index].child[bit] = new_index;
                    tree.nodes.push(HuffmanNode {
                        child: [-1, -1],
                        symbol: -1,
                    });
                    node_index = new_index as usize;
                } else {
                    node_index = child as usize;
                }
            }
            if tree.nodes[node_index].symbol >= 0
                || tree.nodes[node_index].child != [-1, -1]
            {
                return Err(PortableError::new(
                    PortableErrorCode::ZipSignature,
                    "deflate Huffman tree has a duplicate code",
                ));
            }
            tree.nodes[node_index].symbol = symbol as i32;
        }
        if tree.nodes.len() == 1 {
            return Err(PortableError::new(
                PortableErrorCode::ZipSignature,
                "deflate Huffman tree has no symbols",
            ));
        }
        Ok(tree)
    }

    fn decode<R: Read>(&self, reader: &mut BitReader<'_, R>) -> PortableResult<usize> {
        let mut index = 0usize;
        for _ in 0..15 {
            if self.nodes[index].symbol >= 0 {
                return Ok(self.nodes[index].symbol as usize);
            }
            let bit = reader.read_bits(1)? as usize;
            let child = self.nodes[index].child[bit];
            if child < 0 {
                return Err(PortableError::new(
                    PortableErrorCode::ZipSignature,
                    "deflate stream references a missing Huffman code",
                ));
            }
            index = child as usize;
        }
        if self.nodes[index].symbol >= 0 {
            Ok(self.nodes[index].symbol as usize)
        } else {
            Err(PortableError::new(
                PortableErrorCode::ZipSignature,
                "deflate Huffman code did not terminate",
            ))
        }
    }
}

fn reverse_bits(mut value: u16, length: u8) -> u16 {
    let mut reversed = 0u16;
    for _ in 0..length {
        reversed = (reversed << 1) | (value & 1);
        value >>= 1;
    }
    reversed
}

fn fixed_trees() -> PortableResult<(HuffmanTree, HuffmanTree)> {
    let mut literal_lengths = [0u8; 288];
    for length in &mut literal_lengths[..=143] {
        *length = 8;
    }
    for length in &mut literal_lengths[144..=255] {
        *length = 9;
    }
    for length in &mut literal_lengths[256..=279] {
        *length = 7;
    }
    for length in &mut literal_lengths[280..] {
        *length = 8;
    }
    let distance_lengths = [5u8; 32];
    Ok((
        HuffmanTree::from_lengths(&literal_lengths)?,
        HuffmanTree::from_lengths(&distance_lengths)?,
    ))
}

fn dynamic_trees<R: Read>(
    reader: &mut BitReader<'_, R>,
) -> PortableResult<(HuffmanTree, HuffmanTree)> {
    let literal_count = reader.read_bits(5)? as usize + 257;
    let distance_count = reader.read_bits(5)? as usize + 1;
    let code_length_count = reader.read_bits(4)? as usize + 4;
    if literal_count > 286 || distance_count > 32 {
        return Err(PortableError::new(
            PortableErrorCode::ZipSignature,
            "deflate dynamic tree count is invalid",
        ));
    }
    let order = [16usize, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
    let mut code_lengths = [0u8; 19];
    for index in 0..code_length_count {
        code_lengths[order[index]] = reader.read_bits(3)? as u8;
    }
    let code_length_tree = HuffmanTree::from_lengths(&code_lengths)?;
    let mut lengths = Vec::with_capacity(literal_count + distance_count);
    while lengths.len() < literal_count + distance_count {
        let symbol = code_length_tree.decode(reader)?;
        match symbol {
            0..=15 => lengths.push(symbol as u8),
            16 => {
                let repeat = reader.read_bits(2)? as usize + 3;
                let previous = *lengths.last().ok_or_else(|| {
                    PortableError::new(
                        PortableErrorCode::ZipSignature,
                        "deflate repeat code has no previous length",
                    )
                })?;
                if lengths.len() + repeat > literal_count + distance_count {
                    return Err(PortableError::new(
                        PortableErrorCode::ZipSignature,
                        "deflate repeat code exceeds the tree length",
                    ));
                }
                lengths.extend(std::iter::repeat(previous).take(repeat));
            }
            17 => {
                let repeat = reader.read_bits(3)? as usize + 3;
                if lengths.len() + repeat > literal_count + distance_count {
                    return Err(PortableError::new(
                        PortableErrorCode::ZipSignature,
                        "deflate zero repeat code exceeds the tree length",
                    ));
                }
                lengths.extend(std::iter::repeat(0).take(repeat));
            }
            18 => {
                let repeat = reader.read_bits(7)? as usize + 11;
                if lengths.len() + repeat > literal_count + distance_count {
                    return Err(PortableError::new(
                        PortableErrorCode::ZipSignature,
                        "deflate long zero repeat exceeds the tree length",
                    ));
                }
                lengths.extend(std::iter::repeat(0).take(repeat));
            }
            _ => {
                return Err(PortableError::new(
                    PortableErrorCode::ZipSignature,
                    "deflate code-length symbol is invalid",
                ));
            }
        }
    }
    let literal_tree = HuffmanTree::from_lengths(&lengths[..literal_count])?;
    let distance_tree = HuffmanTree::from_lengths(&lengths[literal_count..])?;
    Ok((literal_tree, distance_tree))
}

const LENGTH_BASE: [usize; 29] = [
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99,
    115, 131, 163, 195, 227, 258,
];
const LENGTH_EXTRA: [u8; 29] = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DISTANCE_BASE: [usize; 30] = [
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025,
    1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DISTANCE_EXTRA: [u8; 30] = [
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12,
    13, 13,
];

fn inflate_stream<R: Read, W: Write>(
    compressed: &mut R,
    output: &mut EntryOutput<'_, '_, '_, W>,
) -> PortableResult<()> {
    let mut reader = BitReader::new(compressed);
    let (fixed_literal, fixed_distance) = fixed_trees()?;
    loop {
        let final_block = reader.read_bits(1)? != 0;
        let block_type = reader.read_bits(2)?;
        match block_type {
            0 => {
                reader.align();
                let length = reader.read_aligned_u16()?;
                let inverse = reader.read_aligned_u16()?;
                if length != !inverse {
                    return Err(PortableError::new(
                        PortableErrorCode::ZipSignature,
                        "deflate stored block length checksum is invalid",
                    ));
                }
                for _ in 0..length {
                    output.emit(reader.read_aligned_byte()?)?;
                }
            }
            1 | 2 => {
                let (literal_tree, distance_tree) = if block_type == 1 {
                    (&fixed_literal, &fixed_distance)
                } else {
                    let trees = dynamic_trees(&mut reader)?;
                    // A dynamic tree is used for this block only.  Keep it in a
                    // local tuple so its borrowed references stay valid while
                    // symbols are decoded.
                    decode_compressed_block(&mut reader, output, &trees.0, &trees.1)?;
                    if final_block {
                        break;
                    }
                    continue;
                };
                decode_compressed_block(&mut reader, output, literal_tree, distance_tree)?;
            }
            _ => {
                return Err(PortableError::new(
                    PortableErrorCode::ZipSignature,
                    "deflate block type is reserved",
                ));
            }
        }
        if final_block {
            break;
        }
    }
    Ok(())
}

fn decode_compressed_block<R: Read, W: Write>(
    reader: &mut BitReader<'_, R>,
    output: &mut EntryOutput<'_, '_, '_, W>,
    literal_tree: &HuffmanTree,
    distance_tree: &HuffmanTree,
) -> PortableResult<()> {
    loop {
        let symbol = literal_tree.decode(reader)?;
        match symbol {
            0..=255 => output.emit(symbol as u8)?,
            256 => return Ok(()),
            257..=285 => {
                let length_index = symbol - 257;
                let length = LENGTH_BASE[length_index]
                    + reader.read_bits(LENGTH_EXTRA[length_index])? as usize;
                let distance_symbol = distance_tree.decode(reader)?;
                if distance_symbol >= DISTANCE_BASE.len() {
                    return Err(PortableError::new(
                        PortableErrorCode::ZipSignature,
                        "deflate distance symbol is invalid",
                    ));
                }
                let distance = DISTANCE_BASE[distance_symbol]
                    + reader.read_bits(DISTANCE_EXTRA[distance_symbol])? as usize;
                for _ in 0..length {
                    let byte = output.byte_at_distance(distance)?;
                    output.emit(byte)?;
                }
            }
            _ => {
                return Err(PortableError::new(
                    PortableErrorCode::ZipSignature,
                    "deflate literal/length symbol is invalid",
                ));
            }
        }
    }
}

struct CentralRecord {
    path: String,
    crc32: u32,
    compressed_size: u64,
    uncompressed_size: u64,
    local_header_offset: u64,
}

pub struct ZipWriter<W> {
    writer: W,
    records: Vec<CentralRecord>,
    offset: u64,
    limits: PortableLimits,
    finished: bool,
}

impl<W: Write> ZipWriter<W> {
    pub fn new(writer: W, limits: PortableLimits) -> Self {
        Self {
            writer,
            records: Vec::new(),
            offset: 0,
            limits,
            finished: false,
        }
    }

    pub fn write_entry(
        &mut self,
        path: &str,
        bytes: &[u8],
        control: &mut OperationControl<'_>,
    ) -> PortableResult<()> {
        let mut reader = std::io::Cursor::new(bytes);
        self.write_entry_from_reader(path, &mut reader, bytes.len() as u64, control)
    }

    pub fn write_entry_from_reader<R: Read>(
        &mut self,
        path: &str,
        reader: &mut R,
        expected_size: u64,
        control: &mut OperationControl<'_>,
    ) -> PortableResult<()> {
        if self.finished {
            return Err(PortableError::invalid_request("ZIP writer is already finished"));
        }
        let path = super::safe_archive_path(path, self.limits.max_path_bytes)?;
        if self.records.iter().any(|record| record.path == path) {
            return Err(PortableError::new(
                PortableErrorCode::DuplicateEntry,
                format!("ZIP writer received duplicate path {path}"),
            ));
        }
        if self.records.len() as u64 >= self.limits.max_entries {
            return Err(PortableError::new(
                PortableErrorCode::ZipLimit,
                "ZIP writer entry count exceeds the portable limit",
            ));
        }
        if expected_size > self.limits.max_entry_uncompressed_bytes {
            return Err(PortableError::new(
                PortableErrorCode::ZipLimit,
                format!("ZIP entry exceeds the per-entry limit: {path}"),
            ));
        }
        control.check()?;
        let name = path.as_bytes();
        if name.len() > u16::MAX as usize {
            return Err(PortableError::new(
                PortableErrorCode::InvalidPath,
                "ZIP entry path is too long for a classic ZIP header",
            ));
        }
        let local_header_offset = self.offset;
        self.write_u32(LOCAL_FILE_SIGNATURE)?;
        self.write_u16(20)?;
        self.write_u16(0x0808)?;
        self.write_u16(0)?;
        self.write_u16(0)?;
        self.write_u16(0)?;
        self.write_u32(0)?;
        self.write_u32(0)?;
        self.write_u32(0)?;
        self.write_u16(name.len() as u16)?;
        self.write_u16(0)?;
        self.write_all(name)?;

        let mut buffer = [0u8; 64 * 1024];
        let mut crc = 0xffff_ffff;
        let mut written = 0u64;
        loop {
            control.check()?;
            let read = reader.read(&mut buffer).map_err(PortableError::from)?;
            if read == 0 {
                break;
            }
            written = written.checked_add(read as u64).ok_or_else(|| {
                PortableError::new(PortableErrorCode::ZipLimit, "ZIP entry size overflows")
            })?;
            if written > expected_size {
                return Err(PortableError::new(
                    PortableErrorCode::ZipLimit,
                    format!("ZIP source is larger than declared for {path}"),
                ));
            }
            crc = crc32_update(crc, &buffer[..read]);
            self.write_all(&buffer[..read])?;
            control.report(ProgressEvent {
                phase: ProgressPhase::Write,
                entries_completed: self.records.len() as u64,
                entries_total: self.records.len() as u64 + 1,
                bytes_completed: written,
                bytes_total: expected_size,
            })?;
        }
        if written != expected_size {
            return Err(PortableError::new(
                PortableErrorCode::ZipLimit,
                format!(
                    "ZIP source size mismatch for {path}: expected {expected_size}, wrote {written}"
                ),
            ));
        }
        let crc = !crc;
        self.write_u32(DATA_DESCRIPTOR_SIGNATURE)?;
        self.write_u32(crc)?;
        self.write_u32(written as u32)?;
        self.write_u32(written as u32)?;
        self.records.push(CentralRecord {
            path,
            crc32: crc,
            compressed_size: written,
            uncompressed_size: written,
            local_header_offset,
        });
        Ok(())
    }

    pub fn finish(mut self) -> PortableResult<W> {
        if self.finished {
            return Err(PortableError::invalid_request("ZIP writer is already finished"));
        }
        self.finished = true;
        let central_offset = self.offset;
        let records = std::mem::take(&mut self.records);
        for record in &records {
            let name = record.path.as_bytes();
            if name.len() > u16::MAX as usize
                || record.local_header_offset > u64::from(ZIP64_SENTINEL_32)
                || record.compressed_size > u64::from(ZIP64_SENTINEL_32)
                || record.uncompressed_size > u64::from(ZIP64_SENTINEL_32)
            {
                return Err(PortableError::new(
                    PortableErrorCode::ZipUnsupported,
                    "portable ZIP writer cannot represent this entry in classic ZIP form",
                ));
            }
            self.write_u32(CENTRAL_FILE_SIGNATURE)?;
            self.write_u16(20)?;
            self.write_u16(20)?;
            self.write_u16(0x0808)?;
            self.write_u16(0)?;
            self.write_u16(0)?;
            self.write_u16(0)?;
            self.write_u32(record.crc32)?;
            self.write_u32(record.compressed_size as u32)?;
            self.write_u32(record.uncompressed_size as u32)?;
            self.write_u16(name.len() as u16)?;
            self.write_u16(0)?;
            self.write_u16(0)?;
            self.write_u16(0)?;
            self.write_u16(0)?;
            self.write_u32(0)?;
            self.write_u32(record.local_header_offset as u32)?;
            self.write_all(name)?;
        }
        let central_size = self.offset.saturating_sub(central_offset);
        if records.len() > usize::from(u16::MAX)
            || central_offset > u64::from(ZIP64_SENTINEL_32)
            || central_size > u64::from(ZIP64_SENTINEL_32)
        {
            return Err(PortableError::new(
                PortableErrorCode::ZipUnsupported,
                "portable ZIP central directory requires ZIP64",
            ));
        }
        self.write_u32(END_OF_CENTRAL_SIGNATURE)?;
        self.write_u16(0)?;
        self.write_u16(0)?;
        self.write_u16(records.len() as u16)?;
        self.write_u16(records.len() as u16)?;
        self.write_u32(central_size as u32)?;
        self.write_u32(central_offset as u32)?;
        self.write_u16(0)?;
        Ok(self.writer)
    }

    fn write_all(&mut self, bytes: &[u8]) -> PortableResult<()> {
        self.writer.write_all(bytes).map_err(PortableError::from)?;
        self.offset = self.offset.checked_add(bytes.len() as u64).ok_or_else(|| {
            PortableError::new(PortableErrorCode::ZipLimit, "ZIP output offset overflows")
        })?;
        Ok(())
    }

    fn write_u16(&mut self, value: u16) -> PortableResult<()> {
        self.write_all(&value.to_le_bytes())
    }

    fn write_u32(&mut self, value: u32) -> PortableResult<()> {
        self.write_all(&value.to_le_bytes())
    }
}
