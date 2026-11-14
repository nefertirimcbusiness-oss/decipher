import express from 'express';
const router = express.Router();
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import auth from '../middleware/auth.js';
import { deleteEvidenceFiles, uploadsRoot } from '../lib/evidence-files.js';
import {
  multerLimits,
  MAX_FILES_PER_ENTRY,
  isAllowedEvidenceType,
  rejectOversizedRequest,
  uploadErrorHandler
} from '../lib/upload-limits.js';
import { verifyEvidenceFile } from '../lib/evidence-sniff.js';
import fs from 'fs';
import path from 'path';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Same root that lib/evidence-files.js resolves stored paths against.
    cb(null, uploadsRoot());
  },
  filename: function (req, file, cb) {
    // Only the final path segment of the client's name is kept: `originalname` is
    // whatever the client sent, and a name containing "../" would otherwise choose
    // where the file lands.
    const original = path.basename(String(file.originalname || 'evidence')).replace(/[^\w.\-]+/g, '_');
    cb(null, uuidv4() + '-' + original);
  }
});
// Limits are enforced while the upload streams: a file whose type is not evidence
// is refused before multer stores it, and a file that grows past the size cap is
// cut off and its partial copy deleted. See lib/upload-limits.js.
const upload = multer({
  storage: storage,
  limits: multerLimits,
  fileFilter: function (req, file, cb) {
    if (!isAllowedEvidenceType(file.mimetype)) {
      const error = new Error(`Unsupported evidence type: ${file.mimetype}`);
      error.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(error);
    }
    cb(null, true);
  }
});

router.use(auth);

// After multer has stored the files, look at what they actually are.
//
// The type check in the multer filter is a claim made by the browser; this reads
// the bytes and the extension and refuses anything whose content does not match
// what it says it is. A file that fails is deleted from disk before the answer
// goes out, so a rejected upload leaves nothing behind, and the type stored for a
// file that passes is the one we determined — never the one the client declared.
async function verifyUploadedEvidence(req, res, next) {
  const files = req.files || [];
  if (files.length === 0) return next();

  for (const file of files) {
    let verdict;
    try {
      verdict = await verifyEvidenceFile(file.path, file.originalname);
    } catch (error) {
      console.error('Evidence check failed:', error.message);
      verdict = { ok: false, reason: 'unreadable', detail: 'the file could not be read' };
    }

    if (!verdict.ok) {
      await Promise.all(
        files.map((f) => fs.promises.unlink(f.path).catch(() => {}))
      );
      const error = new Error(`Unsupported evidence file: ${verdict.detail}`);
      error.code = 'UNSUPPORTED_FILE_TYPE';
      return next(error);
    }

    // Store and later serve our own answer for the type.
    file.mimetype = verdict.mime;
  }

  next();
}

// Create entry
router.post(
  '/',
  rejectOversizedRequest,
  upload.array('evidence', MAX_FILES_PER_ENTRY),
  verifyUploadedEvidence,
  async (req, res) => {
    const { title, content } = req.body;
    const userId = req.userId;
    const entryId = uuidv4();

    try {
      query('INSERT INTO entries (id, user_id, title, content) VALUES (?, ?, ?, ?)', [entryId, userId, title, content]);

      if (req.files) {
        for (const file of req.files) {
          const fileId = uuidv4();
          query('INSERT INTO evidence_files (id, entry_id, file_path, file_type) VALUES (?, ?, ?, ?)', [fileId, entryId, file.path, file.mimetype]);
        }
      }

      res.status(201).json({ id: entryId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get all entries for user
router.get('/', async (req, res) => {
  const userId = req.userId;
  try {
    const entries = query('SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    res.json(entries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single entry
router.get('/:id', async (req, res) => {
  const userId = req.userId;
  const entryId = req.params.id;
  try {
    const entries = query('SELECT * FROM entries WHERE id = ? AND user_id = ?', [entryId, userId]);
    if (entries.length === 0) return res.status(404).json({ error: 'Entry not found' });

    const evidence = query('SELECT * FROM evidence_files WHERE entry_id = ?', [entryId]);
    const edits = query('SELECT * FROM edits WHERE entry_id = ?', [entryId]);
    const conversation = query('SELECT * FROM savid_conversations WHERE entry_id = ? ORDER BY created_at ASC', [entryId]);

    res.json({ ...entries[0], evidence, edits, conversation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update entry
router.put('/:id', async (req, res) => {
  const userId = req.userId;
  const entryId = req.params.id;
  const { title, content, reason } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'Edit reason is required' });
  }

  try {
    const entries = query('SELECT * FROM entries WHERE id = ? AND user_id = ?', [entryId, userId]);
    if (entries.length === 0) return res.status(404).json({ error: 'Entry not found' });

    const previousContent = entries[0].content;
    const editId = uuidv4();

    query('INSERT INTO edits (id, entry_id, previous_content, edit_reason) VALUES (?, ?, ?, ?)', [editId, entryId, previousContent, reason]);
    query('UPDATE entries SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [title, content, entryId]);

    res.json({ message: 'Entry updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete entry
router.delete('/:id', async (req, res) => {
  const userId = req.userId;
  const entryId = req.params.id;
  try {
    const entries = query('SELECT * FROM entries WHERE id = ? AND user_id = ?', [entryId, userId]);
    if (entries.length === 0) return res.status(404).json({ error: 'Entry not found' });

    // Remove the uploaded evidence from disk *before* dropping the rows that point
    // at it: once the rows are gone there is no record left of which files to
    // delete, so doing it the other way round could orphan files forever.
    // Unlinking is idempotent (a file that is already gone is not an error), so a
    // retry after a failure is safe.
    const evidence = query('SELECT file_path FROM evidence_files WHERE entry_id = ?', [entryId]);
    const files = await deleteEvidenceFiles(evidence.map((row) => row.file_path));

    if (files.failed.length > 0) {
      return res.status(500).json({
        error: 'Could not delete the evidence files for this entry, so the entry was not deleted. Please retry.',
        files_failed: files.failed
      });
    }

    query('DELETE FROM evidence_files WHERE entry_id = ?', [entryId]);
    query('DELETE FROM edits WHERE entry_id = ?', [entryId]);
    query('DELETE FROM savid_conversations WHERE entry_id = ?', [entryId]);
    query('DELETE FROM entries WHERE id = ?', [entryId]);

    res.json({
      message: 'Entry deleted successfully',
      files: {
        deleted: files.deleted.length,
        already_missing: files.missing.length,
        skipped: files.skipped
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// multer reports its rejections as errors; without this they would surface as a
// 500 "internal server error", which tells a caller nothing about what to fix.
router.use(uploadErrorHandler);

export default router;
