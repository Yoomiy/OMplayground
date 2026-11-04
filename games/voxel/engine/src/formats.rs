//! Release wire formats. Version 2 stores states as little-endian u16.
use crate::{blocks, gen, mesher};
pub const COLUMN: &[u8; 4] = b"VXC2";
pub const REGION: &[u8; 4] = b"VXR2";
pub const EDITS: &[u8; 4] = b"VXE2";
pub fn wrap(tag: &[u8; 4], bytes: Vec<u8>) -> Vec<u8> {
    let mut out = Vec::with_capacity(4 + bytes.len()); out.extend_from_slice(tag); out.extend(bytes); out
}
pub fn unwrap<'a>(tag: &[u8; 4], bytes: &'a [u8]) -> Result<&'a [u8], String> {
    if bytes.get(..4) != Some(tag.as_slice()) { return Err("binary format/version mismatch".into()); }
    Ok(&bytes[4..])
}
fn state(id: u16) -> Result<(), String> {
    if id as usize >= blocks::registry().count { return Err("unknown or reserved block state".into()); } Ok(())
}
pub fn valid_state(id: u16) -> bool { state(id).is_ok() }
fn sections(bytes: &[u8], offset: usize, masks: &[u16]) -> Result<usize, String> {
    let size = masks.iter().map(|m| m.count_ones() as usize * 8192).sum::<usize>();
    let end = offset + size;
    let data = bytes.get(offset..end).ok_or("truncated sections")?;
    for b in data.chunks_exact(2) { state(u16::from_le_bytes([b[0], b[1]]))?; }
    Ok(end)
}
pub fn column(bytes: &[u8]) -> Result<&[u8], String> {
    let data = unwrap(COLUMN, bytes)?;
    if data.len() < gen::HEADER_BYTES { return Err("truncated column header".into()); }
    let mask = u16::from_le_bytes([data[0], data[1]]);
    let emit = u16::from_le_bytes([data[2], data[3]]);
    if emit & !mask != 0 { return Err("emitter outside section mask".into()); }
    if sections(data, gen::HEADER_BYTES, &[mask])? != data.len() { return Err("column trailing bytes".into()); }
    Ok(data)
}
pub fn region(bytes: &[u8]) -> Result<&[u8], String> {
    let data = unwrap(REGION, bytes)?;
    if data.len() < mesher::REGION_HEADER { return Err("truncated region header".into()); }
    let masks: Vec<_> = (0..9).map(|k| u16::from_le_bytes([data[k*4],data[k*4+1]])).collect();
    let end = sections(data, mesher::REGION_HEADER, &masks)?;
    if end != data.len() {
        let tail = &data[end..];
        if tail.len() < 4 { return Err("truncated damage header".into()); }
        let count = u32::from_le_bytes(tail[..4].try_into().unwrap()) as usize;
        if count > 65534 || tail.len() != 4 + count * 516 { return Err("invalid damage length".into()); }
    }
    Ok(data)
}
pub fn edits(bytes: &[u8]) -> Result<&[u8], String> {
    let data = unwrap(EDITS, bytes)?; let mut off = 0;
    while off < data.len() {
        let header = data.get(off..off+12).ok_or("truncated edit header")?;
        let n = u32::from_le_bytes(header[8..12].try_into().unwrap()) as usize;
        if n > 65536 { return Err("too many edits in column".into()); }
        off += 12;
        let rows = data.get(off..off+n*6).ok_or("truncated edits")?;
        for row in rows.chunks_exact(6) {
            if u32::from_le_bytes(row[..4].try_into().unwrap()) >= 65536 { return Err("invalid local index".into()); }
            state(u16::from_le_bytes([row[4],row[5]]))?;
        }
        off += rows.len();
    }
    Ok(data)
}
