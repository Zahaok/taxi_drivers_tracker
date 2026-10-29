// SVdrivers — почтовая служба.
// Если заданы SMTP_* env — реальная отправка через nodemailer.
// Иначе письма пишутся в outbox (server/data/outbox/*.json + консоль),
// чтобы flow регистрации/сброса был полностью проверяемым локально.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTBOX_DIR = path.join(process.env.SVDRIVERS_DATA_DIR || path.join(__dirname, 'data'), 'outbox');
fs.mkdirSync(OUTBOX_DIR, { recursive: true });

const APP_NAME = 'SVdrivers';
const RESET_TTL_MIN = Number(process.env.RESET_TOKEN_TTL_MIN || 60);
const REG_TTL_MIN = Number(process.env.REG_TOKEN_TTL_MIN || 7 * 24 * 60); // неделя на активацию

export function tokenTtl(kind) {
  return kind === 'registration' ? REG_TTL_MIN : RESET_TTL_MIN;
}

function baseUrl() {
  return process.env.PUBLIC_APP_URL || 'http://localhost:3000';
}

async function sendMail({ to, subject, html, text }) {
  const msg = { to, subject, html, text };
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, ...msg });
    return { delivered: true, via: 'smtp' };
  }
  // Локальный режим: сохраняем письмо в outbox
  const file = path.join(OUTBOX_DIR, `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.json`);
  fs.writeFileSync(file, JSON.stringify(msg, null, 2));
  console.log(`[mail:outbox] -> ${to}: ${subject}`);
  return { delivered: true, via: 'outbox', file };
}

export async function sendRegistrationEmail(user, token) {
  const link = `${baseUrl()}/#/activate?token=${token}`;
  return sendMail({
    to: user.email,
    subject: `${APP_NAME}: подтвердите регистрацию`,
    text: `Здравствуйте, ${user.username}!\n\nДля завершения регистрации в ${APP_NAME} перейдите по ссылке (действует ${Math.round(REG_TTL_MIN / 1440)} сут.):\n${link}\n\nЕсли аккаунт создавал администратор — пароль для первого входа выдан ему; после активации система потребует сменить его.`,
    html: `<p>Здравствуйте, <b>${escapeHtml(user.username)}</b>!</p>
<p>Для завершения регистрации в <b>${APP_NAME}</b> перейдите по ссылке:</p>
<p><a href="${link}">${link}</a></p>
<p style="color:#666">Ссылка действует ${Math.round(REG_TTL_MIN / 1440)} сут. После активации будет обязательна смена пароля.</p>`,
  });
}

export async function sendResetEmail(user, token) {
  const link = `${baseUrl()}/#/reset-password?token=${token}`;
  return sendMail({
    to: user.email,
    subject: `${APP_NAME}: сброс пароля`,
    text: `${user.username}, для смены пароля откройте ссылку (действует ${RESET_TTL_MIN} мин):\n${link}\n\nЕсли запрос отправляли не вы — просто проигнорируйте письмо.`,
    html: `<p>Здравствуйте, <b>${escapeHtml(user.username)}</b>!</p>
<p>Для установки нового пароля откройте ссылку:</p>
<p><a href="${link}">${link}</a></p>
<p style="color:#666">Ссылка действует ${RESET_TTL_MIN} минут и одноразовая. Если запрос отправляли не вы — игнорируйте письмо.</p>`,
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
