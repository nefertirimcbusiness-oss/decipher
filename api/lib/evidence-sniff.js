// What an evidence file actually is.
//
// The upload allowlist used to read one thing: the MIME type the browser declared.
// That is a claim by the client, not a fact about the file — an executable
// announced as `application/octet-stream` was accepted, stored, and served back.
// A file is now judged on two things a client cannot fake together: its extension
// and the first bytes of its content. The extension says what the file claims to
// be, the magic bytes say what it is, and the two must agree.
//
// Everything here answers with a canonical type from our own table, never the
// declared one, so what gets stored and later served is our answer and not the
// uploader's.
import fs from 'node:fs';
import path from 'node:path';

export const MAX_HEAD_BYTES = 4096;

// kind -> the type we will store and serve it as, and the extensions it may carry.
const KINDS = {
  jpeg: { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg', '.jpe'] },
  png: { mime: 'image/png', extensions: ['.png'] },
  gif: { mime: 'image/gif', extensions: ['.gif'] },
  webp: { mime: 'image/webp', extensions: ['.webp'] },
  heic: { mime: 'image/heic', extensions: ['.heic', '.heif'] },
  avif: { mime: 'image/avif', extensions: ['.avif'] },
  pdf: { mime: 'application/pdf', extensions: ['.pdf'] },
  wav: { mime: 'audio/wav', extensions: ['.wav'] },
  mp3: { mime: 'audio/mpeg', extensions: ['.mp3'] },
  m4a: { mime: 'audio/mp4', extensions: ['.m4a', '.m4b'] },
  aac: { mime: 'audio/aac', extensions: ['.aac'] },
  ogg: { mime: 'audio/ogg', extensions: ['.ogg', '.oga', '.opus'] },
  flac: { mime: 'audio/flac', extensions: ['.flac'] },
  webm: { mime: 'audio/webm', extensions: ['.webm'] },
  text: { mime: 'text/plain', extensions: ['.txt', '.text'] }
};

export const ALLOWED_EXTENSIONS = new Set(
  Object.values(KINDS).flatMap((kind) => kind.extensions)
);

// Types that are refused on sight, whatever they are called. These are the ones a
// machine runs: Windows and DOS executables, Linux binaries, macOS binaries, Java
// classes, and archives (a zip is how an .exe usually travels).
const HOSTILE_SIGNATURES = [
  { name: 'windows executable', bytes: [0x4d, 0x5a] }, // "MZ"
  { name: 'linux executable', bytes: [0x7f, 0x45, 0x4c, 0x46] }, // \x7fELF
  { name: 'macOS executable', bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  { name: 'macOS executable', bytes: [0xce, 0xfa, 0xed, 0xfe] },
  { name: 'java class', bytes: [0xca, 0xfe, 0xba, 0xbe] },
  { name: 'zip archive', bytes: [0x50, 0x4b, 0x03, 0x04] }, // "PK\x03\x04"
  { name: 'gzip archive', bytes: [0x1f, 0x8b] }
];

function startsWith(buffer, bytes) {
  if (buffer.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i += 1) {
    if (buffer[i] !== bytes[i]) return false;
  }
  return true;
}

function ascii(buffer, start, end) {
  return buffer.subarray(start, end).toString('latin1');
}

// ISO base media brands (HEIC, AVIF, M4A all share the same container header).
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);
const AVIF_BRANDS = new Set(['avif', 'avis']);
const M4A_BRANDS = new Set(['M4A ', 'M4B ', 'mp42', 'mp41', 'isom', 'iso2', 'dash']);

function sniffFtyp(buffer) {
  if (buffer.length < 12 || ascii(buffer, 4, 8) !== 'ftyp') return null;
  const brand = ascii(buffer, 8, 12);
  if (HEIC_BRANDS.has(brand)) return 'heic';
  if (AVIF_BRANDS.has(brand)) return 'avif';
  if (M4A_BRANDS.has(brand)) return 'm4a';
  return null;
}

// A plain text file is bytes that decode as UTF-8, contain no NULs or stray
// control characters, and do not open like markup. That last rule keeps an HTML
// page renamed to .txt out of the scrapbook: it would be served back to a browser
// one day.
function looksLikePlainText(buffer) {
  if (buffer.length === 0) return false;

  for (const byte of buffer) {
    if (byte === 0x00) return false;
    if (byte < 0x09) return false;
    if (byte > 0x0d && byte < 0x20) return false;
  }

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return false;
  }

  const head = text.replace(/^\uFEFF/, '').trimStart().slice(0, 64).toLowerCase();
  if (!head) return false;
  if (head.startsWith('<')) return false; // HTML, XML, SVG
  if (head.startsWith('#!')) return false; // a script
  if (head.startsWith('<?')) return false;
  return true;
}

/**
 * What kind of file is this, judging by its first bytes?
 * @param {Buffer} head
 * @returns {string|null} a key of KINDS, or null for "not evidence"
 */
export function sniffKind(head) {
  if (!Buffer.isBuffer(head) || head.length === 0) return null;

  for (const signature of HOSTILE_SIGNATURES) {
    if (startsWith(head, signature.bytes)) return null;
  }

  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (ascii(head, 0, 6) === 'GIF87a' || ascii(head, 0, 6) === 'GIF89a') return 'gif';
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return 'webp';
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WAVE') return 'wav';
  if (ascii(head, 0, 4) === '%PDF') return 'pdf';
  if (ascii(head, 0, 4) === 'OggS') return 'ogg';
  if (ascii(head, 0, 4) === 'fLaC') return 'flac';
  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm';

  const ftyp = sniffFtyp(head);
  if (ftyp) return ftyp;

  // MP3: an ID3 tag, or a bare MPEG audio frame header (0xFFEx / 0xFFFx).
  if (ascii(head, 0, 3) === 'ID3') return 'mp3';
  if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0) {
    // ADTS AAC shares the top bits; it is told apart by the layer bits being 00.
    return (head[1] & 0x06) === 0 ? 'aac' : 'mp3';
  }

  if (looksLikePlainText(head)) return 'text';

  return null;
}

export function mimeForKind(kind) {
  return (kind && KINDS[kind] && KINDS[kind].mime) || null;
}

/** The canonical type for a type string we may have stored, or null. */
export function safeMimeForStoredType(storedType) {
  if (typeof storedType !== 'string') return null;
  const wanted = storedType.toLowerCase().split(';')[0].trim();
  for (const kind of Object.values(KINDS)) {
    if (kind.mime === wanted) return kind.mime;
  }
  return null;
}

async function readHead(absolutePath) {
  const handle = await fs.promises.open(absolutePath, 'r');
  try {
    const buffer = Buffer.alloc(MAX_HEAD_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, MAX_HEAD_BYTES, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * Decide whether a stored upload is evidence we are willing to keep.
 *
 * @param {string} absolutePath  where multer put the file
 * @param {string} originalName  the name the client sent, for its extension
 * @returns {Promise<{ok: true, mime: string, kind: string} | {ok: false, reason: string, detail: string}>}
 */
export async function verifyEvidenceFile(absolutePath, originalName) {
  const extension = path.extname(typeof originalName === 'string' ? originalName : '').toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      reason: 'extension',
      detail: extension ? `extension "${extension}" is not an evidence type` : 'file has no extension'
    };
  }

  const head = await readHead(absolutePath);

  for (const signature of HOSTILE_SIGNATURES) {
    if (startsWith(head, signature.bytes)) {
      return { ok: false, reason: 'content', detail: `content is a ${signature.name}, not evidence` };
    }
  }

  const kind = sniffKind(head);
  if (!kind) {
    return { ok: false, reason: 'content', detail: 'content is not a photo, recording, PDF or text file' };
  }

  if (!KINDS[kind].extensions.includes(extension)) {
    return {
      ok: false,
      reason: 'mismatch',
      detail: `content is ${KINDS[kind].mime} but the name says ${extension}`
    };
  }

  return { ok: true, kind, mime: KINDS[kind].mime };
}
