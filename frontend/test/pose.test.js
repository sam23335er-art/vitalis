// Автотесты логики ИИ-тренера: node --test test/pose.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angle, evaluateFrame, EXERCISES, RepCounter, P } from '../src/lib/pose.js';

// Синтетическая «поза» для брусьев: плечо, локоть с заданным углом, кисть, таз
function dipsPose(elbowDeg, leanDeg = 0) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  const sh = { x: 0.5, y: 0.3, visibility: 1 };
  const el = { x: 0.5, y: 0.45, visibility: 1 };
  // поворачиваем вектор локоть→плечо на нужный угол
  const t = (elbowDeg * Math.PI) / 180;
  const wr = { x: el.x + 0.15 * Math.sin(t), y: el.y - 0.15 * Math.cos(t), visibility: 1 };
  const l = (leanDeg * Math.PI) / 180;
  const hip = { x: sh.x + 0.3 * Math.sin(l), y: sh.y + 0.3 * Math.cos(l), visibility: 1 };
  lm[P.lShoulder] = sh;
  lm[P.lElbow] = el;
  lm[P.lWrist] = wr;
  lm[P.lHip] = hip;
  lm[P.nose] = { x: 0.5, y: 0.2, visibility: 1 };
  return lm;
}

// Плавное движение от угла к углу — как реальные кадры видео
function path(...points) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    for (let k = 0; k <= 12; k++) out.push(a + ((b - a) * k) / 12);
  }
  return out;
}

function run(counter, angles, lean = 0) {
  const events = [];
  for (const a of angles) events.push(...counter.update(evaluateFrame('dips', dipsPose(a, lean))));
  return events;
}

const newCounter = (opts = {}) => new RepCounter({ lock: EXERCISES.dips.lock, depthMsg: EXERCISES.dips.depthMsg, ...opts });

test('угол считается верно', () => {
  assert.equal(Math.round(angle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })), 90);
  assert.equal(Math.round(evaluateFrame('dips', dipsPose(80)).angle), 80);
  assert.equal(Math.round(evaluateFrame('dips', dipsPose(170)).angle), 170);
});

test('три правильных повтора засчитываются', () => {
  const c = newCounter();
  run(c, path(175, 80, 175, 80, 175, 80, 175));
  assert.equal(c.good, 3);
  assert.equal(c.bad, 0);
});

test('неполная амплитуда не засчитывается', () => {
  const c = newCounter();
  const ev = run(c, path(175, 125, 175));
  assert.equal(c.good, 0);
  assert.equal(c.bad, 1);
  assert.match(ev.find((e) => e.type === 'bad').text, /ниже/i);
});

test('без выхода наверх повтор не засчитывается', () => {
  const c = newCounter();
  run(c, path(175, 80, 125, 80, 175));
  assert.equal(c.bad, 1, 'первый повтор без локаута — ошибка');
  assert.equal(c.good, 1, 'второй повтор — правильный');
});

test('ошибка техники (наклон корпуса) не засчитывается', () => {
  const c = newCounter();
  run(c, path(175, 80, 175), 65);
  assert.equal(c.good, 0);
  assert.equal(c.bad, 1);
});

test('строгий режим: ошибка сбрасывает счёт', () => {
  const c = newCounter({ strict: true });
  const ev = run(c, path(175, 80, 175, 80, 175, 125, 175));
  assert.equal(c.good, 0);
  assert.ok(ev.some((e) => e.type === 'reset'));
});

test('цель подхода', () => {
  const c = newCounter({ target: 2 });
  const ev = run(c, path(175, 80, 175, 80, 175));
  assert.ok(ev.some((e) => e.type === 'done'));
});

test('человек не в кадре — кадр пропускается', () => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.1 }));
  assert.equal(evaluateFrame('dips', lm).visible, false);
  const c = newCounter();
  assert.deepEqual(c.update(evaluateFrame('dips', lm)), []);
});
