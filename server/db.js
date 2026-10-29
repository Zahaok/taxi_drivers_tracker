// SVdrivers — слой персистентности (SQLite через better-sqlite3).
// Схема легко портируется на PostgreSQL/Supabase: те же имена таблиц/колонок,
// вместо ? подставляются $1..$n (см. supabase/schema.sql).
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.SVDRIVERS_DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'svdrivers.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,          -- bcrypt, plaintext никогда не хранится
  role TEXT NOT NULL CHECK (role IN ('driver','manager','admin')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('registration','reset')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tokens_user ON auth_tokens(user_id);
`);

export const usersRepo = {
  all() {
    return db.prepare('SELECT * FROM users ORDER BY created_at').all();
  },
  byId(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },
  byEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(String(email).trim().toLowerCase());
  },
  create(u) {
    db.prepare(`INSERT INTO users (id, username, email, password_hash, role, must_change_password, created_at)
                VALUES (@id, @username, @email, @password_hash, @role, @must_change_password, @created_at)`).run(u);
    return this.byId(u.id);
  },
  updatePassword(id, hash, mustChange) {
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?').run(hash, mustChange ? 1 : 0, id);
    return this.byId(id);
  },
  setMustChange(id, v) {
    db.prepare('UPDATE users SET must_change_password = ? WHERE id = ?').run(v ? 1 : 0, id);
  },
  touchLogin(id) {
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  },
  updateProfile(id, { username, email, role }) {
    db.prepare('UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?').run(username, email, role, id);
    return this.byId(id);
  },
  remove(id) {
    db.prepare('DELETE FROM auth_tokens WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },
};

export const tokensRepo = {
  create({ token, user_id, kind, ttlMinutes }) {
    const now = new Date();
    const exp = new Date(now.getTime() + ttlMinutes * 60000).toISOString();
    db.prepare(`INSERT INTO auth_tokens (token, user_id, kind, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?)`).run(token, user_id, kind, exp, now.toISOString());
    return { token, user_id, kind, expires_at: exp };
  },
  find(token) {
    return db.prepare('SELECT * FROM auth_tokens WHERE token = ?').get(token);
  },
  markUsed(token) {
    db.prepare('UPDATE auth_tokens SET used_at = ? WHERE token = ?').run(new Date().toISOString(), token);
  },
  // Отменяем все активные токены данного типа для пользователя (один действующий сброс за раз)
  revokeActive(userId, kind) {
    db.prepare('UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND kind = ? AND used_at IS NULL')
      .run(new Date().toISOString(), userId, kind);
  },
  purgeExpired() {
    db.prepare('DELETE FROM auth_tokens WHERE expires_at < ?').run(new Date().toISOString());
  },
};

export default db;
