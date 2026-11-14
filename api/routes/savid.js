import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import auth from '../middleware/auth.js';
import { SavidEngine } from 'savid-engine';
import { rateLimit, clientIp, userKey } from '../lib/rate-limit.js';
import { CRISIS_MESSAGE, detectCrisis, isFallbackReply } from '../lib/crisis.js';

const savid = new SavidEngine();

// What Savid says when the engine cannot answer at all and nothing is in danger.
const CALM_FALLBACK =
  "I'm here, and I'm listening. Sometimes the words are hard to find, and that's okay. Take a deep breath.";

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

    // 3. Is this a crisis? Asked of the user's own words, before the model is
    // called, so the answer does not depend on the model being reachable.
    const crisis = detectCrisis(message);

    // 4. Call Savid Engine. A throw here must not lose the crisis reply, so the
    // failure is contained and handled below rather than escaping to the 500.
    let response;
    let savidText;
    try {
      response = await savid.generateResponse(message, history);
      savidText = response && typeof response.savid_response === 'string' ? response.savid_response : null;
    } catch (error) {
      console.error('Savid engine failed:', error.message);
      response = null;
      savidText = null;
    }

    if (crisis) {
      // The crisis message is returned whatever the model did. When the model
      // produced a real reply it follows the crisis message; when it failed, was
      // rate-limited, or answered with its canned fallback, the crisis message is
      // the reply — the fallback must never be the only thing someone in danger
      // hears.
      const modelReplied = !isFallbackReply(savidText);
      const reply = modelReplied ? savidText : CRISIS_MESSAGE;

      // Both are stored, in the order they are shown, so the conversation reads
      // the same after a refresh as it did live.
      query('INSERT INTO savid_conversations (id, entry_id, role, message) VALUES (?, ?, ?, ?)', [uuidv4(), entryId, 'savid', CRISIS_MESSAGE]);
      if (modelReplied) {
        query('INSERT INTO savid_conversations (id, entry_id, role, message) VALUES (?, ?, ?, ?)', [uuidv4(), entryId, 'savid', savidText]);
      }

      // `crisis` and `crisis_message` let the client render the 988 message as a
      // Savid bubble of its own, above whatever the model added.
      return res.json({
        ...(response || {}),
        reply,
        crisis: true,
        crisis_message: CRISIS_MESSAGE,
        follow_up_questions: (response && response.follow_up_questions) || [],
        emotional_analysis: (response && response.emotional_analysis) || null
      });
    }

    // 5. No crisis. An engine that failed outright still gets a gentle answer
    // rather than a null reply.
    const savidText2 = savidText || CALM_FALLBACK;

    // 6. Save Savid response
    query('INSERT INTO savid_conversations (id, entry_id, role, message) VALUES (?, ?, ?, ?)', [uuidv4(), entryId, 'savid', savidText2]);

    // `reply` is the field the client reads (src/lib/api.ts -> savid.chat);
    // `savid_response` is kept because it is the engine's own shape.
    res.json({ ...(response || {}), reply: savidText2, crisis: false });
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
