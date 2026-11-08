import express from 'express';
const router = express.Router();
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query } from '../db.js';
import auth from '../middleware/auth.js';
import { resolveEvidencePath } from '../lib/evidence-files.js';

router.use(auth);

// Bump when the shape of the bundle changes, so anyone holding an old file can
// tell which format they have.
const FORMAT_VERSION = 1;

// Evidence is stored under a `<uuid>-<original name>` filename (see the multer
// storage in routes/entries.js). The uuid is an implementation detail; the name
// the person gave the file is what belongs in their own export.
const STORED_NAME_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

function originalFileName(filePath) {
  const base = path.basename(typeof filePath === 'string' ? filePath : '');
  return base.replace(STORED_NAME_PREFIX, '') || base || 'evidence';
}

// Read one evidence file off disk and inline it into the bundle.
//
// The privacy policy promises "a portable copy" of the user's data, which means
// the actual bytes — a list of filenames would not be a copy of anything. Base64
// keeps the whole bundle a single self-describing JSON file (no zip dependency,
// no archive format to explain), and sha256 lets the user prove the bytes came
// out intact.
//
// A file that is gone or unreadable does NOT fail the export: the rest of the
// data is still theirs to keep. It is reported in `warnings` instead, so the
// bundle never silently claims to be complete when it is not.
async function readEvidence(row, entryId, warnings) {
  const meta = {
    id: row.id,
    file_name: originalFileName(row.file_path),
    file_type: row.file_type,
    created_at: row.created_at
  };

  const { absolute, insideRoot } = resolveEvidencePath(row.file_path);

  if (!absolute || !insideRoot) {
    warnings.push({
      entry_id: entryId,
      evidence_id: row.id,
      file_name: meta.file_name,
      issue: 'stored path is outside the uploads directory; contents not included'
    });
    return { ...meta, included: false };
  }

  try {
    const buffer = await fs.promises.readFile(absolute);
    return {
      ...meta,
      included: true,
      size_bytes: buffer.length,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
      encoding: 'base64',
      content_base64: buffer.toString('base64')
    };
  } catch (error) {
    warnings.push({
      entry_id: entryId,
      evidence_id: row.id,
      file_name: meta.file_name,
      issue: error.code === 'ENOENT'
        ? 'file is missing from storage'
        : `file could not be read (${error.code || error.message})`
    });
    return { ...meta, included: false };
  }
}

// Everything the API holds about the calling user, as one portable JSON file.
//
// The account exported is ALWAYS the one the bearer token belongs to. There is no
// user id in the URL, the query string or the body, and every read below is
// scoped by `req.userId` (entries) or by entry ids that already came from a
// user-scoped query (evidence, edits, conversations). That scoping is the whole
// security model of this endpoint: one user can never export another's data, and
// a request cannot ask for someone else's.
router.get('/', async (req, res) => {
  const userId = req.userId;

  try {
    const users = query('SELECT id, email, stripe_customer_id, subscription_status, created_at FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const user = users[0];

    const subscriptions = query(
      'SELECT plan_id, status, current_period_end, trial_end, created_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    const entryRows = query('SELECT * FROM entries WHERE user_id = ? ORDER BY created_at ASC', [userId]);

    // One query per table rather than one per entry: `team-db` spawns a process
    // per statement, so a per-entry loop would cost ~160ms per row.
    const entryIds = entryRows.map((entry) => entry.id);
    let evidenceRows = [];
    let editRows = [];
    let conversationRows = [];

    if (entryIds.length > 0) {
      const placeholders = entryIds.map(() => '?').join(', ');
      evidenceRows = query(`SELECT * FROM evidence_files WHERE entry_id IN (${placeholders}) ORDER BY created_at ASC`, entryIds);
      editRows = query(`SELECT * FROM edits WHERE entry_id IN (${placeholders}) ORDER BY created_at ASC`, entryIds);
      conversationRows = query(`SELECT * FROM savid_conversations WHERE entry_id IN (${placeholders}) ORDER BY created_at ASC`, entryIds);
    }

    const groupByEntry = (rows) => {
      const map = new Map();
      for (const row of rows) {
        if (!map.has(row.entry_id)) map.set(row.entry_id, []);
        map.get(row.entry_id).push(row);
      }
      return map;
    };

    const evidenceByEntry = groupByEntry(evidenceRows);
    const editsByEntry = groupByEntry(editRows);
    const conversationsByEntry = groupByEntry(conversationRows);

    const warnings = [];
    const entries = [];

    for (const entry of entryRows) {
      const evidence = [];
      for (const row of evidenceByEntry.get(entry.id) || []) {
        evidence.push(await readEvidence(row, entry.id, warnings));
      }

      const edits = (editsByEntry.get(entry.id) || []).map((row) => ({
        id: row.id,
        created_at: row.created_at,
        edit_reason: row.edit_reason,
        previous_content: row.previous_content
      }));

      const savidConversation = (conversationsByEntry.get(entry.id) || []).map((row) => ({
        id: row.id,
        role: row.role,
        message: row.message,
        created_at: row.created_at
      }));

      entries.push({
        id: entry.id,
        title: entry.title,
        content: entry.content,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
        evidence,
        edits,
        savid_conversation: savidConversation
      });
    }

    // A flat, ordered view of every edit — the "edit log" — so the reasons are
    // readable without walking the entries. `previous_content` stays on the entry
    // copy above so the same text is not sent twice.
    const editLog = entries.flatMap((entry) =>
      entry.edits.map((edit) => ({
        entry_id: entry.id,
        entry_title: entry.title,
        edit_id: edit.id,
        created_at: edit.created_at,
        edit_reason: edit.edit_reason
      }))
    );

    const bundle = {
      export: {
        application: 'Decipher',
        format_version: FORMAT_VERSION,
        generated_at: new Date().toISOString(),
        contents: 'account, entries (with evidence files as base64), edit log with reasons, Savid conversations',
        evidence_encoding: 'base64',
        note: 'Evidence files are inlined under entries[].evidence[].content_base64, with a sha256 of the original bytes. Decipher is not a substitute for professional medical advice.'
      },
      account: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        subscription_status: user.subscription_status,
        billing_customer_id: user.stripe_customer_id,
        subscriptions: subscriptions.map((row) => ({
          plan_id: row.plan_id,
          status: row.status,
          current_period_end: row.current_period_end,
          trial_end: row.trial_end,
          created_at: row.created_at
        }))
      },
      entries,
      edit_log: editLog,
      warnings
    };

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `decipher-scrapbook-${stamp}.json`;

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(JSON.stringify(bundle, null, 2));
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Could not build your export. Nothing was changed — please try again.' });
  }
});

export default router;
