import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import auth from '../middleware/auth.js';
import { SavidEngine } from 'savid-engine';

const savid = new SavidEngine();

router.use(auth);

router.post('/chat', async (req, res) => {
  const { entryId, message } = req.body;
  const userId = req.userId;

  try {
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

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:entryId', async (req, res) => {
  const { entryId } = req.params;
  try {
    const conversation = query('SELECT * FROM savid_conversations WHERE entry_id = ? ORDER BY created_at ASC', [entryId]);
    res.json(conversation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
