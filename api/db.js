import { spawnSync } from 'child_process';

function escape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'string') {
    return "'" + val.replace(/'/g, "''") + "'";
  }
  // For objects/arrays, we'll store as JSON string
  return "'" + JSON.stringify(val).replace(/'/g, "''") + "'";
}

export function query(sql, params = []) {
  let processedSql = sql;
  if (params && params.length > 0) {
    let index = 0;
    processedSql = sql.replace(/\?/g, () => {
      if (index >= params.length) return '?';
      const val = params[index++];
      return escape(val);
    });
  }

  try {
    const result = spawnSync('team-db', [processedSql], { encoding: 'utf8' });
    
    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error(`team-db exited with code ${result.status}: ${result.stderr}`);
    }

    // team-db returns empty string for some commands (like CREATE TABLE)
    if (!result.stdout || result.stdout.trim() === '') {
      return [];
    }

    return JSON.parse(result.stdout);
  } catch (error) {
    console.error('Database error:', error.message);
    throw error;
  }
}
