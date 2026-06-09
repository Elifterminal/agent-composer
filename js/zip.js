// zip.js — minimal store-only (no compression) ZIP writer. WAV doesn't
// compress meaningfully, so STORE keeps stem packaging dependency-free and
// fast. No deps.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosDateTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// entries: [{ name: string, data: Uint8Array }] -> Blob (application/zip)
export function zipBlob(entries) {
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  const now = dosDateTime(new Date());
  for (const { name, data } of entries) {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);            // version needed to extract
    local.setUint16(6, 0x0800, true);        // flags: UTF-8 names
    local.setUint16(8, 0, true);             // method: STORE
    local.setUint16(10, now.time, true);
    local.setUint16(12, now.date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);  // compressed = uncompressed (store)
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);            // extra length
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);
    central.push({ nameBytes, crc, size: data.length, offset });
    offset += 30 + nameBytes.length + data.length;
  }
  const cdStart = offset;
  for (const e of central) {
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);               // version made by
    cd.setUint16(6, 20, true);               // version needed
    cd.setUint16(8, 0x0800, true);           // flags: UTF-8 names
    cd.setUint16(10, 0, true);               // method: STORE
    cd.setUint16(12, now.time, true);
    cd.setUint16(14, now.date, true);
    cd.setUint32(16, e.crc, true);
    cd.setUint32(20, e.size, true);
    cd.setUint32(24, e.size, true);
    cd.setUint16(28, e.nameBytes.length, true);
    cd.setUint32(42, e.offset, true);        // extra/comment/disk/attrs stay 0
    chunks.push(new Uint8Array(cd.buffer), e.nameBytes);
    offset += 46 + e.nameBytes.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, central.length, true);
  end.setUint16(10, central.length, true);
  end.setUint32(12, offset - cdStart, true);
  end.setUint32(16, cdStart, true);
  chunks.push(new Uint8Array(end.buffer));
  return new Blob(chunks, { type: "application/zip" });
}
