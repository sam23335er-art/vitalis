import { t } from '../i18n.jsx';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useAuth, useToast } from '../context.jsx';
import { Btn, ConfirmBtn, Icon, PageHead, Spinner } from '../app/ui.jsx';

const SUGGEST = [
  'Сколько мне пить воды?',
  'Сколько калорий мне нужно?',
  'Что есть после тренировки?',
  'Как правильно отжиматься на брусьях?',
  'Когда я увижу результат?',
  'Болят мышцы после тренировки',
];

// Простое форматирование ответа: абзацы, списки (- или 1.), **жирный текст**
const ITEM = /^\s*([-•*]|\d+[.)])\s+/;
const inline = (s) =>
  s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <b key={i}>{part.slice(2, -2)}</b> : part));

export function Rich({ text }) {
  const out = [];
  String(text)
    .split(/\n{2,}/)
    .forEach((block, bi) => {
      // Внутри абзаца подряд идущие пункты собираем в список, остальные строки — в текст
      let para = [];
      let list = null;
      const flushPara = () => {
        if (para.length) out.push(<p key={`p${bi}-${out.length}`}>{para.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </span>
            ))}</p>);
        para = [];
      };
      const flushList = () => {
        if (list) {
          const Tag = list.ordered ? 'ol' : 'ul';
          out.push(
            <Tag key={`l${bi}-${out.length}`}>
              {list.items.map((l, j) => (
                <li key={j}>{inline(l)}</li>
              ))}
            </Tag>
          );
        }
        list = null;
      };
      for (const line of block.split('\n')) {
        const m = line.match(ITEM);
        if (m) {
          flushPara();
          const ordered = /\d/.test(m[1]);
          if (!list || list.ordered !== ordered) {
            flushList();
            list = { ordered, items: [] };
          }
          list.items.push(line.replace(ITEM, ''));
        } else if (line.trim()) {
          flushList();
          para.push(line);
        }
      }
      flushList();
      flushPara();
    });
  return out;
}

export default function Assistant() {
  const { user } = useAuth();
  const toast = useToast();
  const loc = useLocation();
  const nav = useNavigate();
  const status = useApi('/api/ai/status');
  const chat = useApi('/api/ai/chat');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const sentPrompt = useRef(false);

  const messages = chat.data || [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  const send = async (msg) => {
    const q = (msg ?? text).trim();
    if (q.length < 2 || sending) return;
    setText('');
    setSending(true);
    const tmp = { id: `tmp-${Date.now()}`, role: 'user', content: q };
    chat.setData((l) => [...(l || []), tmp]);
    try {
      const r = await api.post('/api/ai/chat', { message: q });
      chat.setData((l) => [...(l || []).filter((m) => m.id !== tmp.id), r.user, r.assistant]);
    } catch (e) {
      chat.setData((l) => (l || []).filter((m) => m.id !== tmp.id));
      setText(q);
      toast.error(e);
    } finally {
      setSending(false);
    }
  };

  const rate = async (m, rating) => {
    const next = m.rating === rating ? 0 : rating;
    chat.setData((l) => l.map((x) => (x.id === m.id ? { ...x, rating: next } : x)));
    try {
      await api.patch(`/api/ai/chat/${m.id}`, { rating: next });
      if (next === -1) toast.info(t('Спасибо! Ответ передан тренерам для улучшения'));
    } catch (e) {
      toast.error(e);
    }
  };

  // Вопрос, переданный из другого раздела (например, из «Анализов»)
  useEffect(() => {
    const p = loc.state?.prompt;
    if (p && !sentPrompt.current && chat.data) {
      sentPrompt.current = true;
      nav(loc.pathname, { replace: true, state: null });
      send(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.data]);

  const last = messages[messages.length - 1];

  return (
    <>
      <PageHead
        title={t('Помощник VITALIS')}
        text={t('Отвечает с твоими личными цифрами · знает {n} тем. Работает без интернета и платных сервисов.', { n: status.data?.topics ?? '…' })}
      >
        {messages.length > 0 && (
          <ConfirmBtn
            confirmText={t('Очистить переписку?')}
            onConfirm={async () => {
              await api.del('/api/ai/chat');
              chat.setData([]);
            }}
          >
            {t('Очистить')}
          </ConfirmBtn>
        )}
      </PageHead>

      <div className="chat">
        <div className="chat-scroll">
          {chat.loading && !chat.data && <Spinner />}
          {chat.data && messages.length === 0 && (
            <div className="chat-hello">
              <span className="feature-icon">
                <Icon name="chat" size={26} />
              </span>
              <h2>{t('Привет, {name}! Чем помочь?', { name: user.name })}</h2>
              <p className="muted">{t('Спрашивай про воду, калории, питание, технику упражнений, восстановление и клуб. Я подставлю твои личные цифры из профиля.')}</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`msg-wrap msg-wrap-${m.role}`}>
              <div className={`msg msg-${m.role} ${m.matched === false ? 'msg-unknown' : ''}`}>
                {m.role === 'assistant' ? <Rich text={m.content} /> : <p>{m.content}</p>}
              </div>
              {m.role === 'assistant' && !String(m.id).startsWith('tmp') && (
                <div className="msg-tools">
                  <button className={`rate ${m.rating === 1 ? 'is-on' : ''}`} onClick={() => rate(m, 1)} aria-label={t('Полезно')} title={t('Полезно')}>
                    👍
                  </button>
                  <button className={`rate ${m.rating === -1 ? 'is-on' : ''}`} onClick={() => rate(m, -1)} aria-label={t('Не помогло')} title={t('Не помогло')}>
                    👎
                  </button>
                  {m === last &&
                    (m.suggestions || []).map((s) => (
                      <button key={s} className="achip achip-sm" onClick={() => send(s)} disabled={sending}>
                        {t(s)}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="msg msg-assistant msg-typing">
              <span />
              <span />
              <span />
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length < 2 && (
          <div className="chips">
            {SUGGEST.map((s) => (
              <button key={s} className="achip" onClick={() => send(s)} disabled={sending}>
                {t(s)}
              </button>
            ))}
          </div>
        )}

        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t('Напиши вопрос…')}
            rows={1}
            maxLength={1000}
          />
          <Btn type="submit" icon="send" loading={sending} disabled={text.trim().length < 2} aria-label={t('Отправить')} />
        </form>
        <p className="fine center">{t('Помощник не заменяет врача. При боли, травме или недомогании обратись к специалисту.')}</p>
      </div>
    </>
  );
}
