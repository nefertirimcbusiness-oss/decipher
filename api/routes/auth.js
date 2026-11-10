import express from 'express';
const router = express.Router();
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
// No fallback: importing this throws when JWT_SECRET is missing, so the process
// cannot boot with a published signing secret.
import { JWT_SECRET } from '../lib/config.js';
import { rateLimit, clientIp, emailKey } from '../lib/rate-limit.js';

// Public, unauthenticated, and expensive (bcrypt). Two budgets per route: one per
// client address, one per account being attempted. The address alone is not
// enough — an attacker rotating addresses still hammers one account — and the
// account alone is not enough, since it lets a caller spray many accounts.
const signupLimit = rateLimit([
  {
    name: 'signup:ip',
    key: clientIp,
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: 'Too many accounts created from here. Please try again later.'
  }
]);

const loginLimit = rateLimit([
  {
    name: 'login:ip',
    key: clientIp,
    windowMs: 5 * 60 * 1000,
    max: 20,
    message: 'Too many sign-in attempts. Please wait a few minutes and try again.'
  },
  {
    name: 'login:email',
    key: emailKey,
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many sign-in attempts for this account. Please wait a few minutes and try again.'
  }
]);

router.post('/signup', signupLimit, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const existing = query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    query('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [id, email, passwordHash]);

    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, userId: id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', loginLimit, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const results = query('SELECT * FROM users WHERE email = ?', [email]);
    if (results.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = results[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
