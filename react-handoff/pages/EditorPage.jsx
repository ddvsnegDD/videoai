// src/pages/EditorPage.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Video, Sparkles, Download, ArrowLeft, AlertTriangle, Loader } from 'lucide-react';
import { C } from '../lib/theme';

const glassPanel = {
  background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(16,185,129,0.12)', borderRadius: 20,
  boxShadow: '0 16px 32px rgba(10,46,31,0.03)', padding: 24,
};

const MOTIONS = [
  { id: 'zoom_in', name: 'Мягкий наезд', desc: 'Плавное приближение к лицевой части' },
  { id: 'pan', name: 'Панорама', desc: 'Линейный сдвиг кадра по горизонту' },
  { id: 'light', name: 'Игра света', desc: 'Минимум движения, акцент на бликах' },
];

function ModelCard({ on, onClick, name, desc, cost, accent, accentLight, accentDark }) {
  return (
    <button onClick={onClick} style={{ flex: 1, textAlign: 'left', cursor: 'pointer', padding: 18, borderRadius: 14, background: '#fff', position: 'relative', border: on ? `2px solid ${accent}` : '1px solid #E2EAE6', boxShadow: on ? `0 8px 18px ${accent}1f` : 'none' }}>
      {on && <div style={{ position: 'absolute', top: 14, right: 14, width: 9, height: 9, borderRadius: '50%', background: accent }} />}
      <div style={{ fontSize: 15.5, fontWeight: 800, color: C.dark, marginBottom: 6, fontFamily: '"Manrope", sans-serif' }}>{name}</div>
      <p style={{ fontSize: 12, color: '#46594F', lineHeight: 1.4, margin: '0 0 14px' }}>{desc}</p>
      <span style={{ fontSize: 11, fontWeight: 700, background: accentLight, color: accentDark, padding: '4px 8px', borderRadius: 5 }}>{cost}</span>
    </button>
  );
}

export default function EditorPage() {
  const navigate = useNavigate();
  const [sourceType, setSourceType] = useState('photo');
  const [motion, setMotion] = useState('zoom_in');
  const [model, setModel] = useState('kling');
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | running | done
  const [progress, setProgress] = useState(0);
  const timer = useRef(null);

  // Демо-прогресс. В проде заменить на polling статуса задачи fal.ai.
  const run = () => {
    setPhase('running'); setProgress(0);
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + Math.random() * 16 + 7;
        if (next >= 100) { clearInterval(timer.current); setTimeout(() => setPhase('done'), 350); return 100; }
        return next;
      });
    }, 360);
  };
  const reset = () => { clearInterval(timer.current); setPhase('idle'); setProgress(0); };
  useEffect(() => () => clearInterval(timer.current), []);

  const stepNum = (n) => <span style={{ color: C.primary, fontFamily: '"Manrope", sans-serif' }}>{n}</span>;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px 56px' }}>
      <style>{`@keyframes va-spin { to { transform: rotate(360deg); } } @media (max-width: 920px){ .va-editor-grid{ grid-template-columns:1fr !important; } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 26 }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#46594F', fontSize: 14, fontWeight: 600 }}><ArrowLeft size={16} /> К проектам</button>
        <div style={{ width: 1, height: 16, background: '#E2E8F0' }} />
        <h1 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 23, fontWeight: 800, color: C.dark, margin: 0, letterSpacing: '-0.02em' }}>Новый видеокреатив</h1>
      </div>

      <div className="va-editor-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 432px', gap: 28, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Шаг 1 */}
          <div style={glassPanel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, fontFamily: '"Manrope", sans-serif', color: C.dark }}>{stepNum('01.')} Исходный контент</h2>
              <div style={{ display: 'flex', background: '#E2E8F0', padding: 3, borderRadius: 9 }}>
                {[['photo', 'Загрузить фото'], ['text', 'Описать словами']].map(([id, l]) => (
                  <button key={id} onClick={() => setSourceType(id)} style={{ border: 'none', cursor: 'pointer', padding: '7px 13px', borderRadius: 7, fontSize: 13, fontWeight: 600, background: sourceType === id ? '#fff' : 'transparent', color: sourceType === id ? C.dark : '#64748B' }}>{l}</button>
                ))}
              </div>
            </div>
            {sourceType === 'photo' ? (
              <div style={{ border: `2px dashed ${C.primary}`, borderRadius: 12, padding: '38px 20px', textAlign: 'center', background: '#F8FBF9', cursor: 'pointer' }}>
                <Upload size={30} color={C.primary} style={{ marginBottom: 10 }} />
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, color: C.dark }}>Перетащите фото товара сюда</div>
                <div style={{ fontSize: 12.5, color: '#6B7F74' }}>Рекомендуемые пропорции 3:4 — под карточки маркетплейсов</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Опишите товар: матовый флакон сыворотки с пипеткой, сочные зелёные листья авокадо, капли воды на стекле, коммерческая съёмка…" style={{ width: '100%', height: 104, borderRadius: 10, background: '#F8FBF9', border: '1px solid #E2EAE6', padding: 14, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 14, color: C.dark, resize: 'none' }} />
                <div style={{ display: 'flex', gap: 10, background: '#FFF4E8', border: '1px solid #FBD9AE', padding: 12, borderRadius: 10, fontSize: 12.5, color: '#8A5A18', lineHeight: 1.45 }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div><b>Пометка:</b> нейросеть создаст ИИ-иллюстрацию <b>по описанию</b>, а не точную копию товара. Для концептов и тестов гипотез. Стоимость: 13 кредитов.</div>
                </div>
              </div>
            )}
          </div>

          {/* Шаг 2 */}
          <div style={glassPanel}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 14px', fontFamily: '"Manrope", sans-serif', color: C.dark }}>{stepNum('02.')} Стиль движения камеры</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {MOTIONS.map(m => {
                const on = motion === m.id;
                return (
                  <button key={m.id} onClick={() => setMotion(m.id)} style={{ textAlign: 'left', cursor: 'pointer', padding: 14, borderRadius: 12, background: '#fff', border: on ? `2px solid ${C.primary}` : '1px solid #E2EAE6', boxShadow: on ? '0 8px 16px rgba(16,185,129,0.1)' : 'none' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: on ? C.primaryLight : '#F1F5F9', display: 'grid', placeItems: 'center', color: on ? C.primary : '#64748B', marginBottom: 10 }}><Video size={16} /></div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: C.dark, marginBottom: 2 }}>{m.name}</div>
                    <div style={{ fontSize: 11.5, color: '#6B7F74', lineHeight: 1.3 }}>{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Шаг 3 */}
          <div style={glassPanel}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 14px', fontFamily: '"Manrope", sans-serif', color: C.dark }}>{stepNum('03.')} Режим рендеринга</h2>
            <div style={{ display: 'flex', gap: 14 }}>
              <ModelCard on={model === 'kling'} onClick={() => setModel('kling')} name="Эконом · Kling 2.5" desc="Клип 5 секунд. Максимально жёсткое удержание мелкого шрифта и геометрии товара." cost="40 кредитов · или 1 free" accent={C.primary} accentLight={C.primaryLight} accentDark={C.primaryDark} />
              <ModelCard on={model === 'veo'} onClick={() => setModel('veo')} name="Премиум · Veo 3.1" desc="Клип 8 секунд. Кинематографичный свет, боке и глубина резкости. Формат 9:16." cost="90 кредитов · или 1 free" accent="#6366F1" accentLight="#EEF2FF" accentDark="#4F46E5" />
            </div>
            <button onClick={run} disabled={phase === 'running'} style={{ width: '100%', border: 'none', cursor: phase === 'running' ? 'default' : 'pointer', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: '#fff', padding: 16, borderRadius: 11, fontSize: 16, fontWeight: 700, marginTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 10px 24px rgba(16,185,129,0.26)', opacity: phase === 'running' ? 0.6 : 1 }}>
              <Sparkles size={18} /> {phase === 'running' ? 'Запуск ИИ-процесса…' : 'Сгенерировать рекламный клип'}
            </button>
          </div>
        </div>

        {/* Монитор */}
        <div style={{ position: 'sticky', top: 86 }}>
          <div style={{ ...glassPanel, minHeight: 540, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            {phase === 'idle' && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F1F5F9', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: '#64748B' }}><Video size={28} /></div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: C.dark }}>Монитор видеоплеера</h3>
                <p style={{ fontSize: 13.5, color: '#6B7F74', margin: 0, lineHeight: 1.45, maxWidth: 260 }}>Настройте параметры слева и запустите движок рендеринга.</p>
              </div>
            )}
            {phase === 'running' && (
              <div style={{ width: '100%', padding: 20, boxSizing: 'border-box' }}>
                <div style={{ textAlign: 'center', marginBottom: 22 }}>
                  <Loader size={30} color={C.primary} style={{ animation: 'va-spin 1s linear infinite', marginBottom: 12 }} />
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.dark }}>Оживляю ваш товар…</div>
                  <div style={{ fontSize: 12.5, color: '#6B7F74', marginTop: 4 }}>Обычно занимает 30–90 секунд</div>
                </div>
                <div style={{ width: '100%', height: 6, background: '#E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, progress)}%`, height: '100%', background: `linear-gradient(90deg, ${C.primary}, ${C.primaryDark})`, borderRadius: 10, transition: 'width .35s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7F74', marginTop: 8 }}>
                  <span>Статус: рендеринг…</span><span>{Math.min(100, Math.round(progress))}%</span>
                </div>
                <button onClick={reset} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'block', margin: '24px auto 0' }}>Отменить операцию</button>
              </div>
            )}
            {phase === 'done' && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '9 / 16', maxHeight: 400, borderRadius: 12, overflow: 'hidden', background: '#000', margin: '0 auto 16px' }}>
                  <video src={model === 'veo' ? '/demo/clip1.mp4' : '/demo/clip3.mp4'} controls autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.62)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{model === 'veo' ? 'Veo 3.1 · 8s' : 'Kling 2.5 · 5s'}</div>
                </div>
                <button style={{ width: '100%', border: 'none', background: C.dark, color: '#fff', padding: 14, borderRadius: 11, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Download size={16} /> Скачать готовый креатив (MP4)</button>
                <button onClick={reset} style={{ background: 'none', border: 'none', color: '#6B7F74', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 12 }}>Создать ещё один</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
