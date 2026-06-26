const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/app.sqlite');
const SCHEMA_PATH = path.join(__dirname, '../../db/schema.sql');

let _db = null;

function getDb() {
  if (!_db) {
    const needsInit = !fs.existsSync(DB_PATH);
    _db = new DatabaseSync(DB_PATH);
    _db.exec('PRAGMA journal_mode = WAL');
    _db.exec('PRAGMA foreign_keys = ON');
    if (needsInit) {
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
      _db.exec(schema);
    }
  }
  return _db;
}

function transaction(fn) {
  const db = getDb();
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { getDb, transaction };
