// Limits on evidence uploads.
//
// Evidence is the only part of the API a caller can make us write to disk, so it
// is the one place a stranger can fill the machine up. Every limit here is
// enforced before the bytes are stored: the request's declared size is checked
// before the body is read, the file count and type are checked before multer
// hands a file to its storage engine, and a file that turns out to be oversized
// mid-stream is cut off at the limit and its partial file deleted.

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per file
export const MAX_FILES_PER_ENTRY = 5;
export const MAX_TOTAL_BYTES = 60 * 1024 * 1024; // 60 MB per request
export const MAX_FIELD_BYTES = 1024 * 1024; // entry title + content, generously

// What a memory journal's evidence actually is: photos, audio recordings, and the
// odd document. Anything that a browser would *execute* (HTML, SVG, XML, JS) is
// not evidence and is refused.
//
// `application/octet-stream` is allowed on purpose: browsers send it for any file
// whose type they do not know, including ordinary ones, and refusing it would
// break honest uploads without stopping anything — an attacker can rename a file
// to any allowed type regardless. The type list keeps active content out; it is
// not a malware scan.
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif',
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav',
  'audio/webm', 'audio/ogg', 'audio/flac', 'audio/opus',
  'application/pdf', 'text/plain',
  'application/octet-stream'
]);

export function isAllowedEvidenceType(mimetype) {
  if (typeof mimetype !== 'string' || !mimetype) return false;
  return ALLOWED_MIME.has(mimetype.toLowerCase().split(';')[0].trim());
}

export const multerLimits = {
  fileSize: MAX_FILE_BYTES,
  files: MAX_FILES_PER_ENTRY,
  fields: 10,
  fieldSize: MAX_FIELD_BYTES,
  parts: MAX_FILES_PER_ENTRY + 10
};

function mb(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

// Refuse a request whose declared body size is already too large, before a single
// byte of it is read. Chunked uploads declare nothing, so this is a fast path, not
// the only guard — multer's per-file and per-request caps cover those.
export function rejectOversizedRequest(req, res, next) {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_TOTAL_BYTES) {
    return res.status(413).json({
      error: `That upload is too large. Evidence is limited to ${MAX_FILES_PER_ENTRY} files and ${mb(MAX_TOTAL_BYTES)} per entry.`
    });
  }
  next();
}

// multer's own rejections, translated into answers a client can act on.
export function uploadErrorHandler(err, req, res, next) {
  if (!err) return next();

  switch (err.code) {
    case 'UNSUPPORTED_FILE_TYPE':
      return res.status(415).json({
        error: `That file type is not accepted. Evidence can be a photo, an audio recording, a PDF or a plain text file.`
      });
    case 'LIMIT_FILE_SIZE':
      return res.status(413).json({
        error: `That file is too large. Each evidence file can be at most ${mb(MAX_FILE_BYTES)}.`
      });
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_PART_COUNT':
      return res.status(413).json({
        error: `Too many files. An entry can have at most ${MAX_FILES_PER_ENTRY} evidence files.`
      });
    case 'LIMIT_FIELD_VALUE':
    case 'LIMIT_FIELD_KEY':
    case 'LIMIT_FIELD_COUNT':
      return res.status(413).json({
        error: 'That entry text is too long to save.'
      });
    case 'LIMIT_UNEXPECTED_FILE':
      return res.status(400).json({
        error: 'Unexpected file field. Evidence files must be sent in the "evidence" field.'
      });
    default:
      if (typeof err.code === 'string' && err.code.startsWith('LIMIT_')) {
        return res.status(413).json({ error: 'That upload was refused: it exceeds the size or count limit for evidence.' });
      }
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
  }
}
