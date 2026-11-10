import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import auth from '../middleware/auth.js';
import { SavidEngine } from 'savid-engine';
import { rateLimit, clientIp, userKey } from '../lib/rate-limit.js';

const savid = new SavidEngine();

router.use(auth);

// Every chat turn costs an AI call, so it is the most expensive thing a signed-in
// user can ask for. The per-user budget is the real one; the address budget is a
// backstop against one machine opening many accounts to pool them.
const chatLimit = rateLimit([
  {
    name: 'savid:user',
    key: userKey,
    windowMs: 5 * 60 * 1000,
    max: 30,
    message: 'Savid needs a moment. Please wait a few minutes before continuing this conversation.'
  },
  {
    name: 'savid:ip',
    key: clientIp,
    windowMs: 5 * 60 * 1000,
    max: 120,
    message: 'Savid needs a moment. Please wait a few minutes and try again.'
  }
]);

router.post('/chat', chatLimit, async (req, res) => {
  const { entryId, message } = req.body || {};
  const userId = req.userId;

  // Validate before touching the database. `savid_conversations.entry_id` is NOT
  // NULL and references an entry, so a missing or bogus entryId used to surface
  // as a 500 "internal server error" — a bug in the request reported as a bug in
  // the server. The client always sends an entry id (only /entries/[id] calls
  // this), so anything else is a malformed request.
  if (!entryId || typeof entryId !== 'string') {
    return res.status(400).json({ error: 'entryId is required' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    // 0. The entry must exist and belong to the caller.
    const entryRows = query('SELECT id FROM entries WHERE id = ? AND user_id = ?', [entryId, userId]);
    if (entryRows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // 1. Fetch history for this entry to provide context to Savid (BEFORE saving current message)
    const historyRows = query('SELECT role, message FROM savid_conversations WHERE entry_id = ? ORDER BY created_at ASC', [entryId]);
    const history = historyRows.map(row => ({ role: row.role, content: row.message }));

    // 2. Save user message
    const userMsgId = uuidv4();
    query('INSERT INTO savid_conversations (id, entry_id, role, message) VALUES (?, ?, ?, ?)', [userMsgId, entryId, 'user', message]);

    // 3. Call Savid Engine
    const response = await savid.generateResponse(message, history);
    const savidText = response.savid_response;
    
    // 4. Save Savid response
    const savidMsgId = uuidv4();
    query('INSERT INTO savid_conversations (id, entry_id, role, message) VALUES (?, ?, ?, ?)', [savidMsgId, entryId, 'savid', savidText]);

    // `reply` is the field the client reads (src/lib/api.ts -> savid.chat);
    // `savid_response` is kept because it is the engine's own shape.
    res.json({ ...response, reply: savidText });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

  // Read the conversation for one entry.
  //
  // `savid_conversations` rows are keyed by entry only, so querying them by
  // `entry_id` alone handed any signed-in user any other user's conversation with
  // Savid — the most private text in the product. The entry is looked up scoped to
  // `req.userId` first (same pattern as `router.get('/:id')` in entries.js), and a
  // mismatch is a 404 rather than a 403: in an app full of trauma journals, even
  // "that entry exists but is not yours" is information the caller must not get.
  router.get('/:entryId', async (req, res) => {
    const { entryId } = req.params;
    const userId = req.userId;
    try {
      const entryRows = query('SELECT id FROM entries WHERE id = ? AND user_id = ?', [entryId, userId]);
      if (entryRows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      const conversation = query('SELECT * FROM savid_conversations WHERE entry_id = ? ORDER BY created_at ASC', [entryId]);
      res.json(conversation);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

export default router;
