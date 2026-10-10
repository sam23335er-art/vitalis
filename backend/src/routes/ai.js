// Чат со встроенным помощником: история, оценки ответов, совет дня
import { Router } from 'express';
import { buildVars, FALLBACK, findAnswer, normalize, renderAnswer } from '../services/ai.js';
import { assistantContext } from '../services/summary.js';
import { ah, badRequest, clean, notFound, rateLimit, seededRandom, todayStr } from '../util.js';

// Записать вопрос без ответа (одинаковые вопросы складываются в счётчик)
function logUnanswered(db, question, userId) {
  const key = normalize(question);
  const existing = db.findOne('unanswered', (u) => u.key === key);
  if (existing) return db.update('unanswered', existing.id, { count: (existing.count || 1) + 1, lastUserId: userId });
  return db.insert('unanswered', { key, question, count: 1, lastUserId: userId });
}

export function answerFor(db, user, message) {
  const result = findAnswer(message, db.all('knowledge'));
  if (!result.entry) {
    logUnanswered(db, message, user.id);
    return { content: FALLBACK, topicId: null, suggestions: result.suggestions, matched: false };
  }
  db.update('knowledge', result.entry.id, { hits: (result.entry.hits || 0) + 1 });
  const vars = buildVars(assistantContext(db, user));
  return { content: renderAnswer(result.entry.answer, vars), topicId: result.entry.id, suggestions: result.suggestions, matched: true };
}

export default function aiRoutes({ db, requireAuth }) {
  const r = Router();
  r.use(requireAuth);

  r.get('/status', (req, res) => {
    res.json({ mode: 'local', topics: db.find('knowledge', (k) => k.enabled !== false).length });
  });

  r.get('/chat', (req, res) => {
    res.json(
      db
        .find('chats', (c) => c.userId === req.user.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(-100)
    );
  });

  r.post(
    '/chat',
    rateLimit(60, 10 * 60_000),
    ah(async (req, res) => {
      const message = clean(req.body?.message, 1000);
      if (message.length < 2) throw badRequest('Напишите вопрос');
      const userMsg = db.insert('chats', { userId: req.user.id, role: 'user', content: message });
      const a = answerFor(db, req.user, message);
      const botMsg = db.insert('chats', {
        userId: req.user.id,
        role: 'assistant',
        content: a.content,
        topicId: a.topicId,
        suggestions: a.suggestions,
        matched: a.matched,
        question: message,
        rating: 0,
      });
      res.status(201).json({ user: userMsg, assistant: botMsg });
    })
  );

  // Оценка ответа: 1 — полезно, -1 — не помогло
  r.patch(
    '/chat/:id',
    ah(async (req, res) => {
      const msg = db.get('chats', req.params.id);
      if (!msg || msg.userId !== req.user.id || msg.role !== 'assistant') throw notFound('Сообщение');
      const rating = Number(req.body?.rating);
      if (![1, 0, -1].includes(rating)) throw badRequest('Оценка: 1, 0 или -1');
      res.json(db.update('chats', msg.id, { rating }));
    })
  );

  r.delete(
    '/chat',
    ah(async (req, res) => {
      res.json({ removed: db.removeWhere('chats', (c) => c.userId === req.user.id) });
    })
  );

  // Совет дня — одна полезная тема из базы, своя для каждого пользователя и дня
  r.get('/tip', (req, res) => {
    const list = db.find('knowledge', (k) => k.enabled !== false && !['Общение', 'Клуб VITALIS', 'Сайт'].includes(k.category));
    if (!list.length) return res.json(null);
    const rnd = seededRandom(`${req.user.id}:${todayStr()}`);
    const entry = list[Math.floor(rnd() * list.length)];
    const vars = buildVars(assistantContext(db, req.user));
    res.json({ id: entry.id, title: entry.title, category: entry.category, content: renderAnswer(entry.answer, vars) });
  });

  return r;
}
