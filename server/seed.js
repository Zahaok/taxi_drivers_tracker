// Инициализация демо-аккаунтов (bcrypt-хэши). Повторный запуск безопасен (INSERT OR IGNORE).
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { usersRepo } from './db.js';

const demo = [
  { username: 'Администратор', email: 'admin@svdrivers.ru', password: 'Admin2026!', role: 'admin' },
  { username: 'Руководитель', email: 'manager@svdrivers.ru', password: 'Manager2026!', role: 'manager' },
  { username: 'Иванов И.И.', email: 'driver@svdrivers.ru', password: 'Driver2026!', role: 'driver' },
];

for (const d of demo) {
  if (usersRepo.byEmail(d.email)) { console.log(`skip ${d.email}`); continue; }
  usersRepo.create({
    id: crypto.randomUUID(),
    username: d.username,
    email: d.email,
    password_hash: bcrypt.hashSync(d.password, 10),
    role: d.role,
    must_change_password: 0,
    created_at: new Date().toISOString(),
  });
  console.log(`created ${d.email} (${d.role})`);
}
console.log('Seed done.');
