// Хранилище данных: JSON-файл, загружается в память, сохраняется атомарно.
// Слой изолирован — при росте нагрузки его можно заменить на PostgreSQL,
// не трогая маршруты (они работают только через методы ниже).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const COLLECTIONS = [
  'users',
  'weights',
  'water',
  'meals',
  'training',
  'sessions',
  'labs',
  'chats',
  'recipes',
  'ingredients',
  'leads',
  'subscribers',
  'knowledge',
  'unanswered',
];

export const newId = () => crypto.randomBytes(9).toString('base64url');

export function createDb(file, seed = {}) {
  let data = {};

  if (fs.existsSync(file)) {
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      // Повреждённый файл не перезаписываем молча — сохраняем копию для разбора
      const backup = `${file}.broken-${Date.now()}`;
      fs.copyFileSync(file, backup);
      console.error(`[db] файл повреждён, копия: ${backup}`);
      data = {};
    }
  }

  for (const name of COLLECTIONS) {
    if (!Array.isArray(data[name])) data[name] = Array.isArray(seed[name]) ? structuredClone(seed[name]) : [];
  }

  let timer = null;

  function writeNow() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
    fs.renameSync(tmp, file);
  }

  // Запись с задержкой 40 мс: пачка изменений сохраняется одной операцией
  function save() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      try {
        writeNow();
      } catch (err) {
        console.error('[db] ошибка записи:', err);
      }
    }, 40);
  }

  const col = (name) => {
    if (!data[name]) throw new Error(`Неизвестная коллекция: ${name}`);
    return data[name];
  };

  const db = {
    all: (name) => col(name),
    find: (name, pred) => col(name).filter(pred),
    findOne: (name, pred) => col(name).find(pred) || null,
    get: (name, id) => col(name).find((x) => x.id === id) || null,

    insert(name, obj) {
      const now = new Date().toISOString();
      const doc = { id: obj.id || newId(), ...obj, createdAt: now, updatedAt: now };
      col(name).push(doc);
      save();
      return doc;
    },

    insertMany(name, list) {
      const now = new Date().toISOString();
      const docs = list.map((obj) => ({ id: newId(), ...obj, createdAt: now, updatedAt: now }));
      col(name).push(...docs);
      save();
      return docs;
    },

    update(name, id, patch) {
      const doc = db.get(name, id);
      if (!doc) return null;
      Object.assign(doc, patch, { id: doc.id, updatedAt: new Date().toISOString() });
      save();
      return doc;
    },

    remove(name, id) {
      const list = col(name);
      const i = list.findIndex((x) => x.id === id);
      if (i === -1) return false;
      list.splice(i, 1);
      save();
      return true;
    },

    removeWhere(name, pred) {
      const list = col(name);
      const before = list.length;
      data[name] = list.filter((x) => !pred(x));
      const removed = before - data[name].length;
      if (removed) save();
      return removed;
    },

    // Дождаться записи на диск (для тестов и корректной остановки)
    async flush() {
      clearTimeout(timer);
      timer = null;
      writeNow();
    },
  };

  return db;
}
