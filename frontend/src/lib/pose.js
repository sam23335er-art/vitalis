// Логика ИИ-тренера: оценка техники по ключевым точкам тела и подсчёт повторений.
// Модуль «чистый» — не зависит от камеры и браузера, поэтому покрыт автотестами.

// Индексы точек модели MediaPipe Pose (33 точки)
export const P = {
  nose: 0,
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
  lHip: 23,
  rHip: 24,
  lKnee: 25,
  rKnee: 26,
  lAnkle: 27,
  rAnkle: 28,
};

const VIS = 0.5;

// Угол в точке b (в градусах) между отрезками b→a и b→c
export function angle(a, b, c) {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (!m) return 180;
  return (Math.acos(Math.min(Math.max(dot / m, -1), 1)) * 180) / Math.PI;
}

// Отклонение отрезка a→b от вертикали (0° — строго вертикально)
export function fromVertical(a, b) {
  return (Math.atan2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 180) / Math.PI;
}

// Приводим нормализованные координаты к пропорциям кадра, чтобы углы были честными
function scale(lm, aspect) {
  return lm.map((p) => (p ? { x: p.x * aspect, y: p.y, visibility: p.visibility ?? 1 } : p));
}

// Берём сторону тела, которая лучше видна камере
function side(lm, keys) {
  const score = (s) => keys.reduce((sum, k) => sum + (lm[P[s + k]]?.visibility ?? 0), 0);
  const s = score('l') >= score('r') ? 'l' : 'r';
  const pt = (k) => lm[P[s + k]];
  return { s, pt };
}

const visible = (...pts) => pts.every((p) => p && (p.visibility ?? 1) >= VIS);

export const EXERCISES = {
  dips: {
    name: 'Отжимания на брусьях',
    joints: 'локоть',
    lock: 155,
    setup: 'Поставь камеру сбоку от брусьев на высоте груди, в 2–3 м. В кадре должны быть голова, руки и таз.',
    depthMsg: 'Опустись ниже — до 90° в локтях',
    evaluate(lm) {
      const { pt } = side(lm, ['Shoulder', 'Elbow', 'Wrist', 'Hip']);
      const [sh, el, wr, hip] = [pt('Shoulder'), pt('Elbow'), pt('Wrist'), pt('Hip')];
      if (!visible(sh, el, wr, hip)) return { visible: false };
      const a = angle(sh, el, wr);
      const lean = fromVertical(sh, hip);
      const violations = [];
      if (lean > 50) violations.push('Сильно заваливаешься вперёд — держи корпус ровнее');
      return { visible: true, angle: a, depthOk: a <= 95, violations };
    },
  },
  pushups: {
    name: 'Отжимания от пола',
    joints: 'локоть',
    lock: 155,
    setup: 'Положи телефон на пол сбоку в 2 м от себя. В кадре — всё тело от головы до пяток.',
    depthMsg: 'Опускайся ниже — грудь почти до пола',
    evaluate(lm) {
      const { pt } = side(lm, ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Ankle']);
      const [sh, el, wr, hip, an] = [pt('Shoulder'), pt('Elbow'), pt('Wrist'), pt('Hip'), pt('Ankle')];
      if (!visible(sh, el, wr, hip, an)) return { visible: false };
      const a = angle(sh, el, wr);
      const body = angle(sh, hip, an);
      const violations = [];
      if (fromVertical(sh, an) < 45) return { visible: true, angle: 180, depthOk: false, violations: [], hint: 'Прими упор лёжа' };
      if (body < 155) violations.push(hip.y > (sh.y + an.y) / 2 ? 'Таз провисает — напряги пресс' : 'Таз поднят — тело должно быть прямой линией');
      return { visible: true, angle: a, depthOk: a <= 95, violations };
    },
  },
  squats: {
    name: 'Приседания',
    joints: 'колено',
    lock: 160,
    setup: 'Встань боком к камере в 2–3 м, камера на уровне пояса. В кадре — всё тело.',
    depthMsg: 'Садись глубже — бедро до параллели с полом',
    evaluate(lm) {
      const { pt } = side(lm, ['Shoulder', 'Hip', 'Knee', 'Ankle']);
      const [sh, hip, kn, an] = [pt('Shoulder'), pt('Hip'), pt('Knee'), pt('Ankle')];
      if (!visible(sh, hip, kn, an)) return { visible: false };
      const a = angle(hip, kn, an);
      const lean = fromVertical(hip, sh);
      const violations = [];
      if (lean > 55) violations.push('Сильный наклон вперёд — грудь вверх, спина прямая');
      return { visible: true, angle: a, depthOk: a <= 100, violations };
    },
  },
  pullups: {
    name: 'Подтягивания',
    joints: 'локоть',
    lock: 150,
    setup: 'Камера спереди на расстоянии 2–3 м, чтобы в кадр попадали перекладина, руки и голова.',
    depthMsg: 'Подбородок выше перекладины',
    evaluate(lm) {
      const nose = lm[P.nose];
      const { pt } = side(lm, ['Shoulder', 'Elbow', 'Wrist']);
      const [sh, el, wr] = [pt('Shoulder'), pt('Elbow'), pt('Wrist')];
      if (!visible(nose, sh, el, wr)) return { visible: false };
      const a = angle(sh, el, wr);
      const wristsY = Math.min(lm[P.lWrist]?.y ?? wr.y, lm[P.rWrist]?.y ?? wr.y);
      return { visible: true, angle: a, depthOk: a <= 90 && nose.y <= wristsY + 0.02, violations: [] };
    },
  },
  curls: {
    name: 'Сгибания на бицепс',
    joints: 'локоть',
    lock: 150,
    setup: 'Встань боком к камере в 2 м, камера на уровне груди. В кадре — корпус и рабочая рука.',
    depthMsg: 'Поднимай вес до конца — до плеча',
    evaluate(lm) {
      const { pt } = side(lm, ['Shoulder', 'Elbow', 'Wrist', 'Hip']);
      const [sh, el, wr, hip] = [pt('Shoulder'), pt('Elbow'), pt('Wrist'), pt('Hip')];
      if (!visible(sh, el, wr, hip)) return { visible: false };
      const a = angle(sh, el, wr);
      const upperArm = angle(el, sh, hip); // угол между плечом и корпусом
      const violations = [];
      if (upperArm > 35) violations.push('Локоть уходит вперёд — прижми его к корпусу');
      return { visible: true, angle: a, depthOk: a <= 55, violations };
    },
  },
};

export function evaluateFrame(exerciseKey, landmarks, aspect = 1) {
  const ex = EXERCISES[exerciseKey];
  if (!ex || !landmarks?.length) return { visible: false };
  return ex.evaluate(scale(landmarks, aspect));
}

// Счётчик повторений — конечный автомат.
// Повтор засчитывается, только если: была полная амплитуда (depthOk),
// не было ошибок техники и спортсмен вернулся в исходное положение (lock).
export class RepCounter {
  constructor({ lock, depthMsg, strict = false, target = 0, smoothing = 0.5 }) {
    this.lock = lock;
    this.depthMsg = depthMsg;
    this.strict = strict;
    this.target = target;
    this.alpha = smoothing;
    this.reset();
  }

  reset() {
    this.good = 0;
    this.bad = 0;
    this.state = 'idle'; // idle → top → rep
    this.smoothed = null;
    this.rep = null;
    this.done = false;
  }

  update(frame) {
    const events = [];
    if (!frame || !frame.visible) return events;

    this.smoothed = this.smoothed === null ? frame.angle : this.smoothed + this.alpha * (frame.angle - this.smoothed);
    const a = this.smoothed;

    if (this.state === 'idle') {
      if (a >= this.lock) {
        this.state = 'top';
        events.push({ type: 'info', text: 'Исходное положение — начинай' });
      }
      return events;
    }

    if (this.state === 'top') {
      if (a < this.lock - 25) {
        this.state = 'rep';
        this.rep = { min: a, depth: false, violations: new Set(), rising: false, maxAfter: a };
      }
      return events;
    }

    // Внутри повтора
    const rep = this.rep;
    (frame.violations || []).forEach((v) => rep.violations.add(v));
    if (frame.depthOk) rep.depth = true;

    if (a < rep.min) {
      rep.min = a;
      rep.rising = false;
      rep.maxAfter = a;
    } else if (a > rep.min + 20) {
      rep.rising = true;
      rep.maxAfter = Math.max(rep.maxAfter, a);
    }

    if (a >= this.lock) {
      events.push(...this.finish(null));
      this.state = 'top';
      return events;
    }

    // Пошёл на новый повтор, не выпрямившись до конца
    if (rep.rising && rep.maxAfter - a > 25) {
      events.push(...this.finish('Не выпрямился до конца — нужен полный выход наверх'));
      this.rep = { min: a, depth: false, violations: new Set(), rising: false, maxAfter: a };
    }
    return events;
  }

  finish(forcedReason) {
    const rep = this.rep;
    this.rep = null;
    const reason = forcedReason || (!rep.depth ? this.depthMsg : rep.violations.size ? [...rep.violations][0] : null);

    if (!reason) {
      this.good += 1;
      const events = [{ type: 'good', text: `Хорошо! ${this.good}`, count: this.good }];
      if (this.target && this.good >= this.target && !this.done) {
        this.done = true;
        events.push({ type: 'done', text: `Подход выполнен: ${this.good} правильных повторений!` });
      }
      return events;
    }

    this.bad += 1;
    const events = [{ type: 'bad', text: `Не засчитано: ${reason}`, reason }];
    if (this.strict && this.good > 0) {
      this.good = 0;
      this.done = false;
      events.push({ type: 'reset', text: 'Строгий режим: счёт сброшен, начинай подход заново' });
    }
    return events;
  }
}
