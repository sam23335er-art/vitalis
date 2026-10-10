import { getLang, t } from '../i18n.jsx';
// ИИ-тренер: камера или видео → точки тела (MediaPipe Pose) → оценка техники → подсчёт повторений.
// Всё распознавание идёт прямо в браузере — видео никуда не отправляется.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { api } from '../api.js';
import { useApi, useToast } from '../context.jsx';
import { Btn, Card, Chip, Field, Icon, PageHead } from '../app/ui.jsx';
import { EXERCISES, evaluateFrame, RepCounter } from '../lib/pose.js';
import { todayStr } from '../lib/format.js';

const REMOTE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const LOCAL_MODEL = '/models/pose_landmarker_lite.task';
const WASM_PATH = '/mediapipe/wasm';

// Модель берём локально, если её положили в public/models, иначе — с серверов Google
async function resolveModelUrl() {
  if (import.meta.env.VITE_POSE_MODEL_URL) return import.meta.env.VITE_POSE_MODEL_URL;
  try {
    const r = await fetch(LOCAL_MODEL, { method: 'HEAD' });
    if (r.ok && !(r.headers.get('content-type') || '').includes('text/html')) return LOCAL_MODEL;
  } catch {
    /* локальной модели нет */
  }
  return REMOTE_MODEL;
}

let landmarkerPromise = null;
function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      const modelAssetPath = await resolveModelUrl();
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      try {
        return await PoseLandmarker.createFromOptions(vision, opts('GPU'));
      } catch {
        return await PoseLandmarker.createFromOptions(vision, opts('CPU'));
      }
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

const SAY = {
  good: (e) => String(e.count),
  bad: (e) => `${t('Не засчитано.')} ${t(e.reason)}`,
  reset: () => t('Счёт сброшен. Начинай заново'),
  done: () => t('Подход выполнен! Отличная работа'),
  info: (e) => e.text,
};

export default function Coach() {
  const toast = useToast();
  const [params] = useSearchParams();
  const [exercise, setExercise] = useState(EXERCISES[params.get('ex')] ? params.get('ex') : 'dips');
  const [target, setTarget] = useState(10);
  const [strict, setStrict] = useState(true);
  const [voice, setVoice] = useState(true);
  const [status, setStatus] = useState('idle'); // idle | loading | running | finished | error
  const [error, setError] = useState('');
  const [counts, setCounts] = useState({ good: 0, bad: 0 });
  const [hud, setHud] = useState({ angle: null, visible: false, warn: '' });
  const [flash, setFlash] = useState(null);
  const [log, setLog] = useState([]);
  const [result, setResult] = useState(null);
  const history = useApi('/api/sessions');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const counterRef = useRef(null);
  const startRef = useRef(0);
  const lastVideoTime = useRef(-1);
  const lastHud = useRef(0);
  const mirrorRef = useRef(true);
  const voiceRef = useRef(voice);
  const fileUrlRef = useRef(null);
  voiceRef.current = voice;

  const ex = EXERCISES[exercise];

  const speak = useCallback((text) => {
    if (!voiceRef.current || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = getLang() === 'uz' ? 'uz-UZ' : 'ru-RU';
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    } catch {
      /* озвучка недоступна */
    }
  }, []);

  const stopMedia = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
      v.removeAttribute('src');
      v.load();
    }
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
      fileUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => stopMedia(), [stopMedia]);

  const draw = (lm, warn) => {
    const c = canvasRef.current;
    const v = videoRef.current;
    if (!c || !v) return;
    if (c.width !== v.videoWidth) c.width = v.videoWidth;
    if (c.height !== v.videoHeight) c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    if (!lm) return;
    const W = c.width;
    const H = c.height;
    ctx.lineWidth = Math.max(3, W / 220);
    ctx.lineCap = 'round';
    ctx.strokeStyle = warn ? '#ff5c61' : '#c6ff3d';
    for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
      const a = lm[start];
      const b = lm[end];
      if (!a || !b || (a.visibility ?? 1) < 0.4 || (b.visibility ?? 1) < 0.4) continue;
      ctx.beginPath();
      ctx.moveTo(a.x * W, a.y * H);
      ctx.lineTo(b.x * W, b.y * H);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    lm.forEach((p, i) => {
      if (i < 11 && i !== 0) return; // точки лица не рисуем
      if ((p.visibility ?? 1) < 0.4) return;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, Math.max(4, W / 200), 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const handleEvents = (events) => {
    for (const e of events) {
      if (e.type === 'good' || e.type === 'bad' || e.type === 'reset') {
        setCounts({ good: counterRef.current.good, bad: counterRef.current.bad });
      }
      if (e.type !== 'info') {
        setFlash({ type: e.type, text: e.type === 'good' ? t('Хорошо!') : e.type === 'done' ? t('Подход выполнен!') : e.type === 'reset' ? t('Заново!') : t('Не засчитано'), id: Date.now() });
      }
      setLog((l) => [{ ...e, t: Date.now() }, ...l].slice(0, 30));
      speak(t(SAY[e.type](e)));
    }
  };

  const loop = () => {
    const v = videoRef.current;
    rafRef.current = requestAnimationFrame(loop);
    if (!v || v.readyState < 2 || v.paused) return;
    if (v.currentTime === lastVideoTime.current) return;
    lastVideoTime.current = v.currentTime;

    const lmk = landmarkerRef.current;
    if (!lmk) return;
    let res;
    try {
      res = lmk.detectForVideo(v, performance.now());
    } catch {
      return;
    }
    const lm = res?.landmarks?.[0];
    const frame = evaluateFrame(exercise, lm, v.videoWidth / v.videoHeight);
    const warn = frame.visible ? (frame.violations || [])[0] || frame.hint || '' : '';
    draw(lm, Boolean(frame.violations?.length));
    handleEvents(counterRef.current.update(frame));

    const now = performance.now();
    if (now - lastHud.current > 120) {
      lastHud.current = now;
      setHud({ angle: frame.visible ? Math.round(frame.angle) : null, visible: Boolean(frame.visible), warn });
    }
  };

  const landmarkerRef = useRef(null);

  const start = async (source, file) => {
    setError('');
    setResult(null);
    setLog([]);
    setStatus('loading');
    try {
      if (source === 'camera') {
        if (!window.isSecureContext) throw new Error(t('Камера работает только по защищённому соединению (https) или на localhost.'));
        if (!navigator.mediaDevices?.getUserMedia) throw new Error(t('Браузер не поддерживает доступ к камере. Попробуйте Chrome или Safari последней версии.'));
      }
      landmarkerRef.current = await getLandmarker();

      stopMedia();
      const v = videoRef.current;
      if (source === 'camera') {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        streamRef.current = stream;
        v.srcObject = stream;
        mirrorRef.current = true;
      } else {
        fileUrlRef.current = URL.createObjectURL(file);
        v.src = fileUrlRef.current;
        mirrorRef.current = false;
      }
      v.muted = true;
      v.playsInline = true;
      await v.play();

      counterRef.current = new RepCounter({ lock: ex.lock, depthMsg: ex.depthMsg, strict, target: Number(target) || 0 });
      setCounts({ good: 0, bad: 0 });
      startRef.current = Date.now();
      lastVideoTime.current = -1;
      setStatus('running');
      speak(t('Встань в исходное положение'));
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      stopMedia();
      setStatus('error');
      const msg =
        err?.name === 'NotAllowedError'
          ? t('Доступ к камере запрещён. Разрешите его в настройках браузера (значок замка в адресной строке) и попробуйте снова.')
          : err?.name === 'NotFoundError'
            ? t('Камера не найдена. Подключите камеру или загрузите видео подхода.')
            : err?.message?.includes('fetch') || err?.message?.includes('Failed')
              ? t('Не удалось загрузить модель распознавания. Проверьте интернет или положите модель в папку public/models (см. README).')
              : err?.message?.includes('StartGraph') || err?.message?.includes('Initialize')
                ? t('Модель распознавания повреждена или несовместима. Удалите файл из public/models — сайт скачает правильную модель автоматически.')
                : err?.message || t('Не удалось запустить ИИ-тренер');
      console.error('[coach]', err);
      setError(msg);
    }
  };

  const stop = async () => {
    stopMedia();
    const c = counterRef.current;
    const durationSec = Math.round((Date.now() - startRef.current) / 1000);
    setStatus('finished');
    if (!c || c.good + c.bad === 0) {
      setResult({ good: 0, bad: 0, empty: true, saved: false });
      return;
    }
    const body = { exercise, goodReps: c.good, badReps: c.bad, durationSec, strict, target: Number(target) || null, date: todayStr() };
    setResult({ good: c.good, bad: c.bad, saved: false });
    try {
      await api.post('/api/sessions', body);
      setResult({ good: c.good, bad: c.bad, saved: true });
      history.reload();
      toast.ok(t('Подход сохранён в историю'));
    } catch (e) {
      toast.error(e);
    }
  };

  // Видео закончилось — завершаем подход
  const onEnded = () => status === 'running' && stop();

  const running = status === 'running';
  const accuracy = counts.good + counts.bad ? Math.round((counts.good / (counts.good + counts.bad)) * 100) : null;

  return (
    <>
      <PageHead title={t('ИИ-тренер')} text={t('Камера видит твоё тело, проверяет технику и засчитывает только правильные повторения.')} />

      <div className="coach">
        <div className="coach-stage">
          <div className={`stage ${mirrorRef.current ? 'is-mirror' : ''} ${running ? 'is-running' : ''}`}>
            <video ref={videoRef} playsInline muted onEnded={onEnded} />
            <canvas ref={canvasRef} />

            {!running && (
              <div className="stage-overlay">
                {status === 'loading' ? (
                  <>
                    <span className="spinner" />
                    <p>{t('Загружаем модель распознавания…')}</p>
                    <small>{t('Первый запуск может занять 5–15 секунд')}</small>
                  </>
                ) : status === 'finished' && result ? (
                  <div className="result">
                    <h3>{t('Подход завершён')}</h3>
                    <div className="result-nums">
                      <div className="good">
                        <b>{result.good}</b>
                        <span>{t('правильно')}</span>
                      </div>
                      <div className="bad">
                        <b>{result.bad}</b>
                        <span>{t('с ошибками')}</span>
                      </div>
                    </div>
                    <p>{result.empty ? t('Повторений не зафиксировано — проверь, что ты целиком в кадре') : result.saved ? t('Сохранено в историю тренировок') : t('Сохраняем…')}</p>
                  </div>
                ) : (
                  <>
                    <Icon name="camera" size={40} />
                    <p>{t(ex.setup)}</p>
                  </>
                )}
              </div>
            )}

            {running && (
              <>
                <div className="hud-count">
                  <b>{counts.good}</b>
                  {target ? <span>/ {target}</span> : null}
                </div>
                <div className="hud-bad">✗ {counts.bad}</div>
                {hud.angle !== null && (
                  <div className="hud-angle">
                    {t(ex.joints)}: {hud.angle}°
                  </div>
                )}
                <div className={`hud-status ${!hud.visible ? 'is-warn' : hud.warn ? 'is-bad' : ''}`}>
                  {!hud.visible ? t('Встань в кадр целиком') : t(hud.warn) || (counterRef.current?.state === 'idle' ? t('Прими исходное положение') : t('Отлично, продолжай'))}
                </div>
                {flash && (
                  <div key={flash.id} className={`hud-flash flash-${flash.type}`}>
                    {t(flash.text)}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="stage-controls">
            {running ? (
              <Btn variant="danger" icon="stop" onClick={stop}>
                {t('Завершить подход')}
              </Btn>
            ) : (
              <>
                <Btn icon="camera" loading={status === 'loading'} onClick={() => start('camera')}>
                  {t('Включить камеру')}
                </Btn>
                <label className={`abtn abtn-ghost ${status === 'loading' ? 'is-disabled' : ''}`}>
                  <Icon name="upload" size={16} />
                  <span>{t('Загрузить видео')}</span>
                  <input
                    type="file"
                    accept="video/*"
                    hidden
                    disabled={status === 'loading'}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) start('file', f);
                    }}
                  />
                </label>
              </>
            )}
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <p className="fine">
            <Icon name="shield" size={13} />{' '}{t('Видео обрабатывается на твоём устройстве и никуда не отправляется. Сохраняется только итог подхода.')}
          </p>
        </div>

        <div className="coach-side">
          <Card title={t('Упражнение')} icon="dumbbell">
            <div className="chips">
              {Object.entries(EXERCISES).map(([k, e]) => (
                <Chip key={k} active={exercise === k} onClick={() => !running && setExercise(k)}>
                  {t(e.name)}
                </Chip>
              ))}
            </div>
            <div className="form-grid">
              <Field label={t('Цель подхода, повт.')}>
                <input inputMode="numeric" value={target} disabled={running} onChange={(e) => setTarget(e.target.value.replace(/\D/g, '').slice(0, 3))} />
              </Field>
              <div className="toggles">
                <label className="switch">
                  <input type="checkbox" checked={strict} disabled={running} onChange={(e) => setStrict(e.target.checked)} />
                  <span>{t('Строгий режим')}</span>
                </label>
                <label className="switch">
                  <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} />
                  <span>
                    <Icon name="volume" size={14} />{' '}{t('Голос')}
                  </span>
                </label>
              </div>
            </div>
            <p className="fine">{strict ? t('Строгий режим: ошибка в технике обнуляет счёт — подход начинается заново.') : t('Обычный режим: неправильные повторения просто не засчитываются.')}</p>
          </Card>

          <Card title={t('Как ставить камеру')} icon="info">
            <p>{t(ex.setup)}</p>
            <ul className="tips small">
              <li>{t('Хорошее освещение спереди, без яркого окна за спиной.')}</li>
              <li>{t('Облегающая одежда — точки суставов определяются точнее.')}</li>
              <li>{t('Начни из исходного положения: руки или ноги выпрямлены.')}</li>
              <li>{t('Засчитывается полная амплитуда')}: {t(ex.depthMsg).toLowerCase()}.</li>
            </ul>
          </Card>

          {running || log.length ? (
            <Card title={t('Журнал подхода')} icon="chat">
              {accuracy !== null && <p className="muted">{t('Точность техники:')}{' '}<b>{accuracy}%</b></p>}
              <ul className="coach-log">
                {log.map((e) => (
                  <li key={e.t + e.text} className={`log-${e.type}`}>
                    {t(e.text)}
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card title={t('Последние подходы')} icon="calendar">
              {(history.data || []).length ? (
                <ul className="crud-list compact">
                  {history.data.slice(0, 6).map((s) => (
                    <li key={s.id}>
                      <span>{t(EXERCISES[s.exercise]?.name)}</span>
                      <span className="good">✓ {s.goodReps}</span>
                      <span className="bad">✗ {s.badReps}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">{t('Здесь появятся результаты твоих подходов.')}</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
