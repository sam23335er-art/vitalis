// Автотесты API: node --test (встроенный в Node.js тест-раннер, без зависимостей)
process.env.NODE_ENV = 'test';
process.env.ADMIN_EMAILS = 'admin@vitalis.uz';
process.env.ADMIN_CODE = 'VITALIS2026';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { todayStr } from '../src/util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalis-test-'));
let server;
let base;
let db;

async function api(method, url, body, token) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

before(async () => {
  const built = createApp({
    dataDir: tmp,
    seedDir: path.join(__dirname, '../data/seed'),
    contentFile: path.join(__dirname, '../data/content.json'),
  });
  db = built.db;
  await new Promise((resolve) => {
    server = built.app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await db.flush();
  server.closeAllConnections?.();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const today = todayStr();
const month = today.slice(0, 7);
let token;
let adminToken;

test('публичные маршруты', async () => {
  assert.equal((await api('GET', '/api/health')).status, 200);
  const content = await api('GET', '/api/content');
  assert.ok(content.data.programs.length > 0);
  const recipes = await api('GET', '/api/recipes');
  assert.ok(recipes.data.length >= 30);
  assert.ok(recipes.data.every((r) => r.kcal > 0 && r.cost > 0), 'у каждого рецепта есть калории и цена');
  const lead = await api('POST', '/api/leads', { name: 'Тест', phone: '901234567' });
  assert.equal(lead.status, 201);
  const bad = await api('POST', '/api/leads', { name: '', phone: '1' });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.errors.phone);
});

test('регистрация, вход и защита маршрутов', async () => {
  const weak = await api('POST', '/api/auth/register', { name: 'Ксения', email: 'k@vitalis.uz', password: '123' });
  assert.equal(weak.status, 400);
  assert.equal((await api('POST', '/api/auth/register', { name: 'Ксения', email: 'k@vitalis.uz', password: '12345678' })).status, 400, 'слишком простой пароль');
  assert.equal((await api('POST', '/api/auth/register', { name: 'Тест', email: 'digits@vitalis.uz', password: '20262027' })).status, 201, 'пароль только из цифр, но не простой — допустим');
  const reg = await api('POST', '/api/auth/register', { name: 'Ксения', email: 'k@vitalis.uz', password: 'vitalis2026' });
  assert.equal(reg.status, 201);
  assert.equal(reg.data.user.role, 'user');
  token = reg.data.token;
  const dup = await api('POST', '/api/auth/register', { name: 'Ксю', email: 'K@vitalis.uz', password: 'vitalis2026' });
  assert.equal(dup.status, 409);
  const wrong = await api('POST', '/api/auth/login', { email: 'k@vitalis.uz', password: 'nope12345' });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.data.error, 'Неверный пароль');
  assert.match((await api('POST', '/api/auth/login', { email: 'nobody@vitalis.uz', password: 'x' })).data.error, /не найден/);
  const ok = await api('POST', '/api/auth/login', { email: 'k@vitalis.uz', password: 'vitalis2026' });
  assert.equal(ok.status, 200);
  assert.equal((await api('GET', '/api/profile')).status, 401);
  assert.equal((await api('GET', '/api/profile', null, 'abc.def.ghi')).status, 401);

  const adm = await api('POST', '/api/auth/register', { name: 'Админ', email: 'admin@vitalis.uz', password: 'admin2026' });
  assert.equal(adm.data.user.role, 'admin');
  adminToken = adm.data.token;
  assert.equal((await api('GET', '/api/admin/stats', null, token)).status, 403);
  assert.equal((await api('GET', '/api/admin/stats', null, adminToken)).status, 200);
});

test('профиль и персональная сводка', async () => {
  const bad = await api('PUT', '/api/profile', { age: 5 }, token);
  assert.equal(bad.status, 400);
  const p = await api(
    'PUT',
    '/api/profile',
    { sex: 'f', age: 30, height: 165, weight: 72, goalWeight: 62, activity: 1.375, goal: 'lose', level: 'beginner', trainingDays: [0, 2, 4], sessionMinutes: 60, budget: 3000000, membership: 590000 },
    token
  );
  assert.equal(p.status, 200);
  const s = await api('GET', '/api/profile/summary', null, token);
  assert.equal(s.data.complete, true);
  assert.ok(s.data.nutrition.kcal >= 1200, 'калории не ниже безопасного минимума');
  assert.ok(s.data.water.restDayMl > 2000);
  assert.equal(s.data.progress.diff, 10);
  assert.ok(s.data.progress.eta.weeksMin > 0 && s.data.progress.eta.weeksMax >= s.data.progress.eta.weeksMin);
  assert.ok(s.data.budget.food > 0);
  assert.equal(s.data.budget.left, 3000000 - s.data.budget.total);
});

test('CRUD веса и воды', async () => {
  const w = await api('POST', '/api/weights', { date: today, weight: 71.5 }, token);
  assert.equal(w.status, 201);
  const again = await api('POST', '/api/weights', { date: today, weight: 71.2 }, token);
  assert.equal(again.status, 200, 'повторная запись за дату обновляет значение');
  const upd = await api('PUT', `/api/weights/${w.data.id}`, { weight: 71 }, token);
  assert.equal(upd.data.weight, 71);
  assert.equal((await api('GET', '/api/weights', null, token)).data.length, 1);
  assert.equal((await api('POST', '/api/weights', { date: '2999-01-01', weight: 70 }, token)).status, 400);
  assert.equal((await api('DELETE', `/api/weights/${w.data.id}`, null, adminToken)).status, 404, 'чужие записи недоступны');
  assert.equal((await api('DELETE', `/api/weights/${w.data.id}`, null, token)).status, 200);

  const water = await api('PUT', `/api/water/${today}`, { ml: 750 }, token);
  assert.equal(water.data.ml, 750);
  const water2 = await api('PUT', `/api/water/${today}`, { ml: 1000 }, token);
  assert.equal(water2.data.id, water.data.id);
  assert.equal((await api('PUT', `/api/water/${today}`, { ml: -5 }, token)).status, 400);
});

test('план питания: генерация, замена, «съел», список покупок, CRUD', async () => {
  const gen = await api('POST', '/api/meals/generate', { month, fromToday: false }, token);
  assert.equal(gen.status, 201);
  const days = Number(month.split('-')[1]) && new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0)).getUTCDate();
  assert.equal(gen.data.created, days * 4, '4 приёма пищи на каждый день месяца');

  const list = await api('GET', `/api/meals?from=${today}&to=${today}`, null, token);
  assert.equal(list.data.length, 4);
  const lunch = list.data.find((m) => m.slot === 'lunch');
  assert.ok(lunch.nutrition.kcal > 0 && lunch.nutrition.ingredients.length > 0);

  const alts = await api('GET', `/api/meals/${lunch.id}/alternatives`, null, token);
  assert.ok(alts.data.length > 0);
  const swapped = await api('PATCH', `/api/meals/${lunch.id}`, { recipeId: alts.data[0].id }, token);
  assert.equal(swapped.data.recipeId, alts.data[0].id);

  const eaten = await api('PATCH', `/api/meals/${lunch.id}`, { eaten: true }, token);
  assert.equal(eaten.data.eaten, true);
  const summary = await api('GET', '/api/profile/summary', null, token);
  assert.ok(summary.data.eaten.kcal > 0);
  assert.ok(summary.data.streak.streak >= 1);

  const shop = await api('GET', `/api/meals/shopping?from=${today}&to=${today}&includeEaten=1`, null, token);
  assert.ok(shop.data.items.length > 0 && shop.data.total > 0);

  const custom = await api('POST', '/api/meals', { date: today, slot: 'snack', custom: { title: 'Самса', kcal: 350, p: 10 } }, token);
  assert.equal(custom.status, 201);
  assert.equal(custom.data.nutrition.kcal, 350);
  assert.equal((await api('DELETE', `/api/meals/${custom.data.id}`, null, token)).status, 200);

  // Повторная генерация не трогает съеденные блюда
  await api('POST', '/api/meals/generate', { month, fromToday: false }, token);
  const after = await api('GET', `/api/meals?from=${today}&to=${today}`, null, token);
  assert.ok(after.data.some((m) => m.id === lunch.id && m.eaten));
  assert.equal(after.data.length, 4);
});

test('анализы: разбор, применение к питанию, CRUD', async () => {
  const preview = await api('POST', '/api/labs/analyze', { values: { glucose: '6,2', cholesterol: 6.1, hemoglobin: 105 } }, token);
  assert.equal(preview.status, 200);
  const flags = preview.data.flags;
  assert.ok(flags.includes('lowSugar') && flags.includes('heart') && flags.includes('ironRich'));

  const crit = await api('POST', '/api/labs/analyze', { values: { glucose: 9 } }, token);
  assert.equal(crit.data.findings[0].status, 'critical');
  assert.equal(crit.data.doctor, true);

  const lab = await api('POST', '/api/labs', { date: today, values: { glucose: 6.2, cholesterol: 6.1 } }, token);
  assert.equal(lab.status, 201);
  const applied = await api('POST', `/api/labs/${lab.data.id}/apply`, null, token);
  assert.deepEqual(applied.data.flags.sort(), ['heart', 'lowSugar']);

  // В пересобранном меню нет блюд с сахаром и жирным мясом
  const recipes = (await api('GET', '/api/recipes')).data;
  const tagsOf = Object.fromEntries(recipes.map((r) => [r.id, r.tags]));
  const meals = (await api('GET', `/api/meals?from=${today}`, null, token)).data.filter((m) => !m.eaten);
  assert.ok(meals.length > 0);
  for (const m of meals) {
    assert.ok(!tagsOf[m.recipeId].includes('sugar') && !tagsOf[m.recipeId].includes('fattyMeat'), `${m.title} не должно быть в меню`);
  }

  const upd = await api('PUT', `/api/labs/${lab.data.id}`, { values: { glucose: 5 } }, token);
  assert.equal(upd.data.analysis.flags.length, 0);
  assert.equal((await api('POST', '/api/labs', { values: {} }, token)).status, 400);
  assert.equal((await api('DELETE', `/api/labs/${lab.data.id}`, null, token)).status, 200);
});

test('тренировки и сессии ИИ-тренера', async () => {
  const gen = await api('POST', '/api/training/generate', { month }, token);
  assert.equal(gen.status, 201);
  const list = await api('GET', `/api/training?from=${month}-01&to=${month}-31`, null, token);
  assert.ok(list.data.every((t) => t.exercises.length > 0));
  const custom = await api('POST', '/api/training', { date: today, title: 'Моя тренировка', exercises: [{ key: 'dips', sets: 3, reps: 10 }] }, token);
  assert.equal(custom.status, 201);
  assert.equal(custom.data.exercises[0].camera, 'dips');
  const done = await api('PATCH', `/api/training/${custom.data.id}`, { done: true }, token);
  assert.equal(done.data.done, true);
  assert.equal((await api('DELETE', `/api/training/${custom.data.id}`, null, token)).status, 200);

  const s = await api('POST', '/api/sessions', { exercise: 'dips', goodReps: 8, badReps: 2, durationSec: 95, strict: true }, token);
  assert.equal(s.status, 201);
  assert.equal((await api('POST', '/api/sessions', { exercise: 'jump', goodReps: 1, badReps: 0 }, token)).status, 400);
  assert.equal((await api('GET', '/api/sessions', null, token)).data.length, 1);
  assert.equal((await api('DELETE', `/api/sessions/${s.data.id}`, null, token)).status, 200);
});

test('встроенный помощник: ответы с личными цифрами, оценки, совет дня', async () => {
  const st = await api('GET', '/api/ai/status', null, token);
  assert.equal(st.data.mode, 'local');
  assert.ok(st.data.topics >= 50, 'в базе 50+ тем');

  const r = await api('POST', '/api/ai/chat', { message: 'Сколько мне пить воды?' }, token);
  assert.equal(r.status, 201);
  assert.equal(r.data.assistant.matched, true);
  assert.match(r.data.assistant.content, /\d[\d ]* мл/, 'в ответе личная норма воды');
  assert.doesNotMatch(r.data.assistant.content, /\{[a-z_]+\}/, 'все подстановки заполнены');

  const kcal = await api('POST', '/api/ai/chat', { message: 'сколько мне нужно калорий' }, token);
  assert.match(kcal.data.assistant.content, /ккал/);

  const like = await api('PATCH', `/api/ai/chat/${r.data.assistant.id}`, { rating: 1 }, token);
  assert.equal(like.data.rating, 1);

  const unknown = await api('POST', '/api/ai/chat', { message: 'как прыгать с парашютом' }, token);
  assert.equal(unknown.data.assistant.matched, false);
  await api('PATCH', `/api/ai/chat/${unknown.data.assistant.id}`, { rating: -1 }, token);

  const tip = await api('GET', '/api/ai/tip', null, token);
  assert.ok(tip.data.title && tip.data.content);

  assert.equal((await api('GET', '/api/ai/chat', null, token)).data.length, 6);
});

test('код администратора', async () => {
  const reg = await api('POST', '/api/auth/register', { name: 'Тренер', email: 'coach@vitalis.uz', password: 'coach2026' });
  const t = reg.data.token;
  assert.equal((await api('GET', '/api/admin/teach/stats', null, t)).status, 403, 'без кода нет доступа');
  assert.equal((await api('POST', '/api/auth/admin-code', { code: 'WRONG123' }, t)).status, 403);
  const ok = await api('POST', '/api/auth/admin-code', { code: 'vitalis2026' }, t);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.role, 'admin');
  assert.equal((await api('GET', '/api/admin/teach/stats', null, t)).status, 200);
});

test('обучение помощника: вопрос без ответа → новая тема → помощник отвечает', async () => {
  const un = await api('GET', '/api/admin/teach/unanswered', null, adminToken);
  const q = un.data.find((x) => x.question.includes('парашют'));
  assert.ok(q, 'вопрос попал в «Без ответа»');

  const disliked = await api('GET', '/api/admin/teach/disliked', null, adminToken);
  assert.ok(disliked.data.some((d) => d.question.includes('парашют')));

  const test1 = await api('POST', '/api/admin/teach/test', { message: 'как прыгать с парашютом' }, adminToken);
  assert.equal(test1.data.best, null);
  assert.ok(test1.data.keywords.length > 0, 'предложены ключевые слова');

  assert.equal((await api('POST', '/api/admin/teach/knowledge', { title: 'x', keywords: '', answer: '' }, adminToken)).status, 400);
  const created = await api(
    'POST',
    '/api/admin/teach/knowledge',
    { title: 'Прыжки с парашютом', category: 'Разное', keywords: 'парашют, прыжок', answer: '{name}, прыжки — только в аэроклубе с инструктором.', unansweredId: q.id },
    adminToken
  );
  assert.equal(created.status, 201);
  assert.equal((await api('GET', '/api/admin/teach/unanswered', null, adminToken)).data.some((x) => x.id === q.id), false);

  const r = await api('POST', '/api/ai/chat', { message: 'хочу прыгнуть с парашютом' }, adminToken);
  assert.equal(r.data.assistant.topicId, created.data.id);
  assert.match(r.data.assistant.content, /^Админ, прыжки/);

  const off = await api('PATCH', `/api/admin/teach/knowledge/${created.data.id}`, { enabled: false }, adminToken);
  assert.equal(off.data.enabled, false);
  assert.equal((await api('POST', '/api/ai/chat', { message: 'парашют' }, adminToken)).data.assistant.matched, false);

  const upd = await api('PUT', `/api/admin/teach/knowledge/${created.data.id}`, { ...created.data, answer: 'Новый ответ про парашют' }, adminToken);
  assert.equal(upd.data.answer, 'Новый ответ про парашют');

  const imp = await api('POST', '/api/admin/teach/knowledge/import', { items: [{ title: 'Йога для спины', keywords: ['йога для спины'], answer: 'Мягкие асаны.' }, { title: '' }] }, adminToken);
  assert.deepEqual([imp.data.added, imp.data.skipped.length], [1, 1]);

  assert.equal((await api('DELETE', `/api/admin/teach/knowledge/${created.data.id}`, null, adminToken)).status, 200);
  assert.equal((await api('GET', '/api/admin/teach/knowledge', null, token)).status, 403, 'клиенту обучение недоступно');
});

test('админка: CRUD продуктов и рецептов, заявки', async () => {
  const ing = await api('POST', '/api/admin/ingredients', { name: 'Тестовый продукт', category: 'Прочее', kcal: 100, p: 10, f: 1, c: 5, price: 10000 }, adminToken);
  assert.equal(ing.status, 201);
  const upd = await api('PUT', `/api/admin/ingredients/${ing.data.id}`, { ...ing.data, price: 12000 }, adminToken);
  assert.equal(upd.data.price, 12000);
  const rec = await api(
    'POST',
    '/api/admin/recipes',
    { title: 'Тестовое блюдо', slots: ['snack'], time: 5, tags: ['quick'], ingredients: [{ id: ing.data.id, g: 100 }], steps: ['Шаг 1'] },
    adminToken
  );
  assert.equal(rec.status, 201);
  assert.equal((await api('DELETE', `/api/admin/ingredients/${ing.data.id}`, null, adminToken)).status, 400, 'нельзя удалить продукт из рецепта');
  assert.equal((await api('DELETE', `/api/admin/recipes/${rec.data.id}`, null, adminToken)).status, 200);
  assert.equal((await api('DELETE', `/api/admin/ingredients/${ing.data.id}`, null, adminToken)).status, 200);

  const users = await api('GET', '/api/admin/users', null, adminToken);
  const target = users.data.find((u) => u.email === 'digits@vitalis.uz');
  const reset = await api('POST', `/api/admin/users/${target.id}/reset-password`, null, adminToken);
  assert.equal(reset.data.password.length, 10);
  assert.equal((await api('POST', '/api/auth/login', { email: 'digits@vitalis.uz', password: reset.data.password })).status, 200, 'вход с временным паролем');

  const leads = await api('GET', '/api/admin/leads', null, adminToken);
  assert.equal(leads.data.length, 1);
  const st = await api('PATCH', `/api/admin/leads/${leads.data[0].id}`, { status: 'called' }, adminToken);
  assert.equal(st.data.status, 'called');
});

test('смена пароля отзывает старые токены, удаление аккаунта', async () => {
  const ch = await api('PUT', '/api/auth/password', { current: 'vitalis2026', next: 'newpass2026' }, token);
  assert.equal(ch.status, 200);
  assert.equal((await api('GET', '/api/auth/me', null, token)).status, 401);
  const fresh = ch.data.token;
  assert.equal((await api('DELETE', '/api/auth/me', null, fresh)).status, 200);
  assert.equal((await api('POST', '/api/auth/login', { email: 'k@vitalis.uz', password: 'newpass2026' })).status, 401);
  assert.equal(db.find('meals', () => true).length, 0, 'данные пользователя удалены');
});
