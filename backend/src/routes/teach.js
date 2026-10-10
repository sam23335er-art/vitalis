// «Обучение» помощника (только администратор): база знаний, вопросы без ответа,
// ответы с плохой оценкой, проверка вопроса, экспорт и импорт.
import { Router } from 'express';
import { buildVars, findAnswer, normalize, PLACEHOLDERS, renderAnswer, stemOf, suggestKeywords } from '../services/ai.js';
import { assistantContext } from '../services/summary.js';
import { ah, badRequest, clean, notFound } from '../util.js';

const slug = (s) =>
  normalize(s)
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'topic';

function parseEntry(b) {
  const errors = {};
  const title = clean(b.title, 120);
  if (title.length < 2) errors.title = 'Напишите вопрос или тему';
  const category = clean(b.category || 'Разное', 40) || 'Разное';
  const rawKw = Array.isArray(b.keywords) ? b.keywords : String(b.keywords || '').split(',');
  const keywords = [...new Set(rawKw.map((k) => clean(k, 60).toLowerCase()).filter((k) => normalize(k).length >= 2))].slice(0, 40);
  if (!keywords.length) errors.keywords = 'Добавьте хотя бы одно ключевое слово';
  // Ответ не чистим от < > агрессивно — разрешаем любой текст, экранирование делает React
  const answer = String(b.answer ?? '').trim().slice(0, 5000);
  if (answer.length < 5) errors.answer = 'Напишите ответ';
  if (Object.keys(errors).length) throw badRequest('Проверьте поля', errors);
  return { title, category, keywords, answer, enabled: b.enabled !== false };
}

export default function teachRoutes({ db, requireAdmin }) {
  const r = Router();
  r.use(requireAdmin);

  const uniqueId = (title) => {
    let id = slug(title);
    while (db.get('knowledge', id)) id = `${slug(title)}-${Math.floor(Math.random() * 10000)}`;
    return id;
  };

  r.get('/placeholders', (req, res) => res.json(PLACEHOLDERS.map(([key, label]) => ({ key, label }))));

  r.get('/stats', (req, res) => {
    const k = db.all('knowledge');
    res.json({
      topics: k.length,
      enabled: k.filter((x) => x.enabled !== false).length,
      unanswered: db.all('unanswered').length,
      disliked: db.find('chats', (c) => c.role === 'assistant' && c.rating === -1).length,
      liked: db.find('chats', (c) => c.role === 'assistant' && c.rating === 1).length,
      questions: db.find('chats', (c) => c.role === 'user').length,
    });
  });

  // ---------- База знаний ----------
  r.get('/knowledge', (req, res) => {
    res.json(db.all('knowledge').slice().sort((a, b) => a.category.localeCompare(b.category, 'ru') || a.title.localeCompare(b.title, 'ru')));
  });

  r.post(
    '/knowledge',
    ah(async (req, res) => {
      const data = parseEntry(req.body || {});
      const doc = db.insert('knowledge', { id: uniqueId(data.title), ...data, hits: 0 });
      // Научили по вопросу без ответа — убираем его из списка
      if (req.body.unansweredId) db.remove('unanswered', String(req.body.unansweredId));
      res.status(201).json(doc);
    })
  );

  r.put(
    '/knowledge/:id',
    ah(async (req, res) => {
      if (!db.get('knowledge', req.params.id)) throw notFound('Тема');
      res.json(db.update('knowledge', req.params.id, parseEntry(req.body || {})));
    })
  );

  r.patch(
    '/knowledge/:id',
    ah(async (req, res) => {
      if (!db.get('knowledge', req.params.id)) throw notFound('Тема');
      res.json(db.update('knowledge', req.params.id, { enabled: Boolean(req.body?.enabled) }));
    })
  );

  r.delete(
    '/knowledge/:id',
    ah(async (req, res) => {
      if (!db.remove('knowledge', req.params.id)) throw notFound('Тема');
      res.json({ ok: true });
    })
  );

  // Импорт из файла: темы с тем же id или названием обновляются, новые добавляются
  r.post(
    '/knowledge/import',
    ah(async (req, res) => {
      const items = Array.isArray(req.body?.items) ? req.body.items : null;
      if (!items || !items.length) throw badRequest('Файл пустой или не того формата');
      if (items.length > 2000) throw badRequest('Слишком много тем в одном файле (максимум 2000)');
      let added = 0;
      let updated = 0;
      const skipped = [];
      items.forEach((it, i) => {
        let data;
        try {
          data = parseEntry(it || {});
        } catch {
          skipped.push(i + 1);
          return;
        }
        const existing =
          (it.id && db.get('knowledge', String(it.id))) || db.findOne('knowledge', (k) => normalize(k.title) === normalize(data.title));
        if (existing) {
          db.update('knowledge', existing.id, data);
          updated += 1;
        } else {
          db.insert('knowledge', { id: uniqueId(data.title), ...data, hits: 0 });
          added += 1;
        }
      });
      res.json({ added, updated, skipped });
    })
  );

  // ---------- Проверка: что ответит помощник ----------
  r.post(
    '/test',
    ah(async (req, res) => {
      const message = clean(req.body?.message, 1000);
      if (message.length < 2) throw badRequest('Напишите вопрос');
      const result = findAnswer(message, db.all('knowledge'));
      const vars = buildVars(assistantContext(db, req.user));
      res.json({
        best: result.best,
        candidates: result.candidates,
        suggestions: result.suggestions,
        answer: result.entry ? renderAnswer(result.entry.answer, vars) : null,
        keywords: suggestKeywords(message),
      });
    })
  );

  // Предпросмотр ответа с подстановкой цифр администратора
  r.post('/render', (req, res) => {
    const vars = buildVars(assistantContext(db, req.user));
    res.json({ text: renderAnswer(String(req.body?.answer || '').slice(0, 5000), vars) });
  });

  r.post('/keywords', (req, res) => {
    res.json({ keywords: suggestKeywords(String(req.body?.text || '')), stem: stemOf(String(req.body?.text || '')) });
  });

  // ---------- Вопросы без ответа ----------
  r.get('/unanswered', (req, res) => {
    res.json(db.all('unanswered').slice().sort((a, b) => (b.count || 1) - (a.count || 1) || b.updatedAt.localeCompare(a.updatedAt)));
  });

  r.delete(
    '/unanswered/:id',
    ah(async (req, res) => {
      if (!db.remove('unanswered', req.params.id)) throw notFound('Вопрос');
      res.json({ ok: true });
    })
  );

  r.delete(
    '/unanswered',
    ah(async (req, res) => {
      res.json({ removed: db.removeWhere('unanswered', () => true) });
    })
  );

  // ---------- Ответы, которые пользователи отметили «Не помогло» ----------
  r.get('/disliked', (req, res) => {
    const titles = Object.fromEntries(db.all('knowledge').map((k) => [k.id, k.title]));
    res.json(
      db
        .find('chats', (c) => c.role === 'assistant' && c.rating === -1)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 200)
        .map((c) => ({ id: c.id, question: c.question, answer: c.content, topicId: c.topicId, topicTitle: titles[c.topicId] || null, date: c.updatedAt }))
    );
  });

  // Снять отметку «Не помогло» после исправления
  r.delete(
    '/disliked/:id',
    ah(async (req, res) => {
      const c = db.get('chats', req.params.id);
      if (!c) throw notFound('Ответ');
      db.update('chats', c.id, { rating: 0, reviewed: true });
      res.json({ ok: true });
    })
  );

  return r;
}
