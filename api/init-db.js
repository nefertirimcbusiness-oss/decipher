import { query } from './db.js';

export function initializeDatabase() {
  console.log('Initializing database...');

  // Users table
  query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      stripe_customer_id TEXT,
      subscription_status TEXT DEFAULT 'inactive',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Entries table
  query(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Evidence files table
  query(`
    CREATE TABLE IF NOT EXISTS evidence_files (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES entries(id)
    )
  `);

  // Edits table
  query(`
    CREATE TABLE IF NOT EXISTS edits (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      previous_content TEXT,
      edit_reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES entries(id)
    )
  `);

  // Savid conversations table
  query(`
    CREATE TABLE IF NOT EXISTS savid_conversations (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES entries(id)
    )
  `);

  // Subscriptions table
  query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      stripe_subscription_id TEXT UNIQUE,
      status TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      current_period_end DATETIME,
      trial_end DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log('Database initialization complete.');
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}
