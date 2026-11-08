import path from 'path';
import { query } from '../db.js';
import { resolveEvidencePath } from './evidence-files.js';

// Serve one evidence file — but only to the user who owns the entry it belongs to.
//
// This replaces `express.static('uploads')`, which handed every uploaded photo,
// audio recording and document to anyone who had the URL: no token, no ownership
// check, on a server that holds trauma journals. Filenames are uuid-prefixed, but
// unguessable is not the same as private.
//
// Mount behind the auth middleware (index.js), which sets `req.userId`.
// Anything that is not one of the caller's own files answers 404 — the same answer
// for "no such file" and "someone else's file", so the response never reveals
// whether a file exists.
export async function serveEvidenceFile(req, res) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'No token provided' });
  }

  let name;
  try {
    name = decodeURIComponent(req.path).replace(/^\/+/, '');
  } catch (error) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Evidence lives as one flat filename inside the uploads root; refuse anything
  // that could walk out of it.
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const rows = query(
      `SELECT f.file_path, f.file_type
         FROM evidence_files f
         JOIN entries e ON e.id = f.entry_id
        WHERE e.user_id = ?`,
      [userId]
    );

    // Compare by basename: `file_path` is stored as multer wrote it ("uploads/<name>"
    // or an absolute path when UPLOADS_DIR is set), while the request carries only
    // the name. Scoping the query by user is what keeps this to the caller's files.
    const owned = rows.find((row) => path.basename(row.file_path || '') === name);
    if (!owned) {
      return res.status(404).json({ error: 'File not found' });
    }

    const { absolute, insideRoot } = resolveEvidencePath(owned.file_path);
    if (!absolute || !insideRoot) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (owned.file_type) res.type(owned.file_type);

    return res.sendFile(absolute, (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ error: 'File not found' });
      }
    });
  } catch (error) {
    console.error('Evidence file read failed:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
