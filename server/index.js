// SVdrivers — бэкенд авторизации: Express + SQLite + bcrypt + JWT + nodemailer.
// Запуск: node server/index.js  (порт 4000, прод-статика из dist/ раздаётся здесь же)
import express from 'express';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { usersRepo, tokensRepo } from './db.js';
import { sendRegistrationEmail, sendResetEmail, tokenTtl } from './mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_PEPPER = process.env.TOKEN_PEPPER || crypto.randomBytes(16).toString('hex');
const DIST_DIR = path.join(__dirname, '..', 'dist');

const app = express();
app.use(express.json({ limit: '1mb' }));

// ---------- helpers ----------
const publicUser = (u) => u && ({
  id: u.id, username: u.username, email: u.email, role: u.role,
  must_change_password: !!u.must_change_password, created_at: u.created_at, last_login_at: u.last_login_at,
}); // password_hash НИКОГДА не отдаётся клиенту

const hashToken = (t) => crypto.createHash('sha256').update(TOKEN_PEPPER + t).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('hex');

function sign(u) {
  return jwt.sign({ sub: u.id, role: u.role }, JWT_SECRET, { expiresIn: '12h' });
}

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = usersRepo.byId(payload.sub);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Сессия истекла, войдите заново' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Только для администратора' });
  next();
}

function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Пароль должен быть не короче 8 символов';
  if (!/[A-Za-zА-Яа-я]/.test(pw) || !/\d/.test(pw)) return 'Пароль должен содержать буквы и цифры';
  return null;
}

// ---------- auth endpoints ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'svdrivers-api' }));

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Укажите email и пароль' });
  const user = usersRepo.byEmail(email);
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Неверный email или пароль' }); // единое сообщение — без утечки существования аккаунта
  }
  usersRepo.touchLogin(user.id);
  res.json({ token: sign(user), user: publicUser(usersRepo.byId(user.id)) });
});

// Смена пароля текущим пользователем (в т.ч. обязательная после первого входа / сброса)
app.post('/api/auth/change-password', auth, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!bcrypt.compareSync(String(current_password ?? ''), req.user.password_hash)) {
    return res.status(400).json({ error: 'Текущий пароль неверен' });
  }
  const err = validatePassword(new_password);
  if (err) return res.status(400).json({ error: err });
  const updated = usersRepo.updatePassword(req.user.id, bcrypt.hashSync(new_password, 10), false);
  res.json({ user: publicUser(updated) });
});

// Запрос сброса пароля (публичный) — письмо с одноразовой ссылкой
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  const user = email ? usersRepo.byEmail(email) : null;
  // Всегда 200 — не раскрываем, зарегистрирован ли email
  if (user) {
    tokensRepo.revokeActive(user.id, 'reset');
    const raw = newToken();
    tokensRepo.create({ token: hashToken(raw), user_id: user.id, kind: 'reset', ttlMinutes: tokenTtl('reset') });
    await sendResetEmail(user, raw);
  }
  res.json({ ok: true, message: 'Если email зарегистрирован — на него отправлено письмо со ссылкой для смены пароля' });
});

// Публичная проверка токена (для отображения формы)
app.get('/api/auth/token-info', (req, res) => {
  const t = String(req.query.token || '');
  const rec = t ? tokensRepo.find(hashToken(t)) : null;
  if (!rec || rec.used_at || new Date(rec.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Ссылка недействительна или истекла' });
  }
  res.json({ kind: rec.kind });
});

// Установка нового пароля по токену (сброс или активация регистрации)
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, new_password } = req.body || {};
  const rec = token ? tokensRepo.find(hashToken(String(token))) : null;
  if (!rec || rec.used_at || new Date(rec.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Ссылка недействительна или истекла. Запросите новую.' });
  }
  const err = validatePassword(new_password);
  if (err) return res.status(400).json({ error: err });
  const user = usersRepo.byId(rec.user_id);
  if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
  tokensRepo.markUsed(hashToken(String(token)));
  usersRepo.updatePassword(user.id, bcrypt.hashSync(new_password, 10), false);
  res.json({ ok: true });
});

// ---------- admin: управление пользователями ----------
app.get('/api/users', auth, requireAdmin, (_req, res) => {
  res.json({ users: usersRepo.all().map(publicUser) });
});

// Создание пользователя админом: генерируется временный пароль,
// на почту уходит письмо-приглашение со ссылкой активации,
// вход с временным паролем требует обязательной смены пароля.
app.post('/api/users', auth, requireAdmin, async (req, res) => {
  const { username, email, role, password } = req.body || {};
  if (!username?.trim() || !email?.trim()) return res.status(400).json({ error: 'Укажите имя и email' });
  if (!['driver', 'manager', 'admin'].includes(role)) return res.status(400).json({ error: 'Некорректная роль' });
  const cleanEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: 'Некорректный email' });
  if (usersRepo.byEmail(cleanEmail)) return res.status(409).json({ error: 'Email уже зарегистрирован' });

  const tempPassword = password && String(password).length >= 8 ? String(password) : generateTempPassword();
  const tempErr = validatePassword(tempPassword);
  if (tempErr) return res.status(400).json({ error: tempErr });

  const user = usersRepo.create({
    id: crypto.randomUUID(),
    username: username.trim(),
    email: cleanEmail,
    password_hash: bcrypt.hashSync(tempPassword, 10),
    role,
    must_change_password: 1,
    created_at: new Date().toISOString(),
  });

  const raw = newToken();
  tokensRepo.create({ token: hashToken(raw), user_id: user.id, kind: 'registration', ttlMinutes: tokenTtl('registration') });
  await sendRegistrationEmail(user, raw);

  res.status(201).json({ user: publicUser(user), temp_password: tempPassword });
});

app.put('/api/users/:id', auth, requireAdmin, (req, res) => {
  const target = usersRepo.byId(req.params.id);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
  const { username, email, role } = req.body || {};
  const cleanEmail = email ? String(email).trim().toLowerCase() : target.email;
  const dup = usersRepo.byEmail(cleanEmail);
  if (dup && dup.id !== target.id) return res.status(409).json({ error: 'Email уже занят' });
  const updated = usersRepo.updateProfile(target.id, {
    username: username?.trim() || target.username,
    email: cleanEmail,
    role: ['driver', 'manager', 'admin'].includes(role) ? role : target.role,
  });
  res.json({ user: publicUser(updated) });
});

// Админ может инициировать сброс пароля пользователя: письмо + требование смены при входе
app.post('/api/users/:id/reset-password', auth, requireAdmin, async (req, res) => {
  const target = usersRepo.byId(req.params.id);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
  tokensRepo.revokeActive(target.id, 'reset');
  const raw = newToken();
  tokensRepo.create({ token: hashToken(raw), user_id: target.id, kind: 'reset', ttlMinutes: tokenTtl('reset') });
  usersRepo.setMustChange(target.id, true);
  await sendResetEmail(target, raw);
  res.json({ ok: true, message: `Письмо со ссылкой для смены пароля отправлено на ${target.email}` });
});

// Админ может выставить требование смены пароля вручную
app.post('/api/users/:id/must-change-password', auth, requireAdmin, (req, res) => {
  const target = usersRepo.byId(req.params.id);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
  usersRepo.setMustChange(target.id, !!req.body?.value);
  res.json({ user: publicUser(usersRepo.byId(target.id)) });
});

app.delete('/api/users/:id', auth, requireAdmin, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Нельзя удалить свой аккаунт' });
  const target = usersRepo.byId(req.params.id);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
  usersRepo.remove(target.id);
  res.json({ ok: true });
});

// ---------- self-service ----------
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

// ---------- статистика outbox (только локальная разработка, чтобы видеть письма) ----------
if (!process.env.SMTP_HOST) {
  app.get('/api/dev/outbox', auth, requireAdmin, (_req, res) => {
    const dir = path.join(process.env.SVDRIVERS_DATA_DIR || path.join(__dirname, 'data'), 'outbox');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse().slice(0, 20) : [];
    res.json({ mails: files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) });
  });
}

// ---------- прод-статика SPA ----------
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

setInterval(() => tokensRepo.purgeExpired(), 10 * 60 * 1000).unref();

function generateTempPassword() {
  // Произносимо-безопасный временный пароль: 10 символов, буквы+цифры
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += abc[crypto.randomInt(abc.length)];
  return s;
}

app.listen(PORT, '0.0.0.0', () => console.log(`SVdrivers API + static → http://0.0.0.0:${PORT}`));
