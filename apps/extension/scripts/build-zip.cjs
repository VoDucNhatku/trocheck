// Packs extension/ into the zip offered by the web's download button. Same input gives the same bytes.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SOURCE = path.join(__dirname, '../extension');
const TARGET = path.join(__dirname, '../../web/public/downloads/trocheck-collector.zip');
const FOLDER = 'trocheck-collector';
// 01/01/2026 00:00 in DOS format, so the file does not change unless the code does.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

function buildZip() {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of fs.readdirSync(SOURCE).sort()) {
    const name = Buffer.from(`${FOLDER}/${file}`);
    const data = fs.readFileSync(path.join(SOURCE, file));
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data);
    const shared = Buffer.alloc(26);
    shared.writeUInt16LE(20, 0); // version needed
    shared.writeUInt16LE(0x0800, 2); // UTF-8 names
    shared.writeUInt16LE(8, 4); // deflate
    shared.writeUInt16LE(DOS_TIME, 6);
    shared.writeUInt16LE(DOS_DATE, 8);
    shared.writeUInt32LE(crc, 10);
    shared.writeUInt32LE(packed.length, 14);
    shared.writeUInt32LE(data.length, 18);
    shared.writeUInt16LE(name.length, 22);
    const localHead = Buffer.alloc(4);
    localHead.writeUInt32LE(0x04034b50);
    locals.push(localHead, shared, name, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    shared.copy(central, 6);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 4 + shared.length + name.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length / 2, 8);
  end.writeUInt16LE(centrals.length / 2, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

if (require.main === module) {
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, buildZip());
  console.log(`${TARGET}: ${fs.statSync(TARGET).size} bytes`);
}

module.exports = { buildZip, TARGET };
