// Точка входа сервера VITALIS
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './src/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5000;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || '';

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&lt;(\/?)b&gt;/g, '<$1b>');

async function notifyTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text: escapeHtml(text), parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[telegram] не удалось отправить уведомление:', err.message);
  }
}

const distDir = path.resolve(__dirname, '../frontend/dist');
const { app, db, adminCode } = createApp({
  dataDir: path.join(__dirname, 'data'),
  seedDir: path.join(__dirname, 'data', 'seed'),
  contentFile: path.join(__dirname, 'data', 'content.json'),
  distDir,
  notify: notifyTelegram,
});

const server = app.listen(PORT, () => {
  console.log(`VITALIS запущен: http://localhost:${PORT}`);
  console.log(`Помощник: встроенный, тем в базе знаний — ${db.find('knowledge', (k) => k.enabled !== false).length} (внешние API не нужны)`);
  console.log(`Код администратора: ${adminCode}  →  кабинет → Профиль → «Доступ администратора»`);
});

// Корректная остановка: дописываем базу на диск
async function shutdown() {
  await db.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
