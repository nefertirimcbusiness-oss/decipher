import jwt from 'jsonwebtoken';
import { query } from '../db.js';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export default (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.userId = decoded.userId;

  // Tokens are stateless and stay valid for 7 days, so a token issued before an
  // account was deleted would otherwise still be able to write new rows for a user
  // that no longer exists — new data created *after* deletion, which nothing would
  // ever clean up. Mutating requests therefore confirm the account still exists.
  // Reads are left alone: every row belonging to a deleted account is already gone,
  // so there is nothing left to read.
  if (MUTATING_METHODS.has(req.method)) {
    try {
      const users = query('SELECT id FROM users WHERE id = ?', [decoded.userId]);
      if (users.length === 0) {
        return res.status(401).json({ error: 'Account no longer exists' });
      }
    } catch (error) {
      console.error('Auth user lookup failed:', error.message);
      return res.status(503).json({ error: 'Could not verify account, please retry' });
    }
  }

  next();
};
