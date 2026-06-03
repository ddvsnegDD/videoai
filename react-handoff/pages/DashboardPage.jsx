// src/pages/DashboardPage.jsx
import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Plus, Download, Trash2, Sparkles, Clock } from 'lucide-react';
import { C } from '../lib/theme';

// В реальном коде проекты приходят через GET /api/projects.
const MOCK = [
  { id: 1, title: 'Сыворотка Авокадо — Креатив 1', status: 'ready', model: 'kling', date: '01.06.2026', video_url: '/demo/clip2.mp4' },
  { id: 2, title: 'Крем Aura — Продакшн-шот', status: 'ready', model: 'veo', date: '31.05.2026', video_url: '/demo/clip1.mp4' },
  { id: 3, title: 'Гель для душа — Тест CTR', status: 'ready', model: 'kling', date: '30.05.2026', video_url: '/demo/clip3.mp4' },
  { id: 4, title: 'Парфюм Элегант — Тест CTR', status: 'pending', model: 'kling', date: 'Идёт рендеринг…', video_url: null },
];

const glassPanel = {
  background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(16,185,129,0.12)', borderRadius: 20,
  boxShadow: '0 16px 32px rgba(10,46,31,0.03)', padding: 24,
};

function ProjectCard({ p }) {
  const v = useRef(null);
  const isVeo = p.model === 'veo';
  useEffect(() => {
    const el = v.current;
    if (!el) return;
    const seek = () => { try { el.currentTime = 2.3; } catch (e) {} };
    el.addEventListener('loadeddata', seek);
    return () => el.removeEventListener('loadeddata', seek);
  }, []);
  return (
    <div
      onMouseEnter={() => v.current?.play().catch(() => {})}
      onMouseLeave={() => { if (v.current) { v.current.pause(); v.current.currentTime = 2.3; } }}
      style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2EAE6', overflow: 'hidden', boxShadow: '0 4px 12px rgba(10,46,31,0.03)' }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: '#0a1f16', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        {p.status === 'ready' ? (
          <>
            <video ref={v} src={p.video_url} muted loop playsInline preload="auto" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'relative', zIndex: 2, width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', display: 'grid', placeItems: 'center', color: C.dark, boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
              <Video size={16} fill="currentColor" style={{ marginLeft: 2 }} />
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: '#94A3B8' }}>
            <Clock size={26} color={C.primary} style={{ animation: 'va-spin 2s linear infinite' }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 6 }}>Рендеринг ИИ…</div>
          </div>
        )}
        <div style={{ position: 'absolute', top: 11, left: 11, zIndex: 3, background: isVeo ? 'rgba(99,102,241,0.92)' : 'rgba(10,46,31,0.82)', color: '#fff', padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{isVeo ? 'Veo 3.1' : 'Kling 2.5'}</div>
      </div>
      <div style={{ padding: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', color: C.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</h3>
        <div style={{ fontSize: 12.5, color: '#6B7F74', marginBottom: 14 }}>{p.date}</div>
        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
          {p.status === 'ready' ? (
            <button style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#F1F5F9', color: C.dark, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Download size={14} /> Скачать MP4</button>
          ) : (
            <button disabled style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#F1F5F9', color: '#94A3B8', fontWeight: 600, fontSize: 13, cursor: 'not-allowed' }}>Рендеринг…</button>
          )}
          <button style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.07)', color: '#EF4444', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '36px 24px 64px' }}>
      <style>{`@keyframes va-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ ...glassPanel, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 24, fontWeight: 800, margin: '0 0 4px', color: C.dark, letterSpacing: '-0.02em' }}>Мои видеокреативы</h1>
            <p style={{ margin: 0, fontSize: 13.5, color: '#46594F' }}>Архив готовых рекламных материалов для маркетплейсов</p>
          </div>
          <div style={{ display: 'flex', gap: 28, borderLeft: '1px solid #E2E8F0', paddingLeft: 32 }}>
            <div>
              <div style={{ color: '#6B7F74', fontSize: 12, marginBottom: 3 }}>Доступный баланс</div>
              <div style={{ fontWeight: 800, color: C.dark, display: 'flex', alignItems: 'center', gap: 5, fontSize: 16, fontFamily: '"Manrope", sans-serif' }}><Sparkles size={14} color={C.primary} /> 240 кредитов</div>
            </div>
            <div>
              <div style={{ color: '#6B7F74', fontSize: 12, marginBottom: 3 }}>Пробные попытки</div>
              <div style={{ fontWeight: 700, color: C.primaryDark, fontSize: 14, marginTop: 2 }}>1 Kling · 1 Veo</div>
            </div>
          </div>
        </div>
        <button onClick={() => navigate('/editor')} style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: '#fff', border: 'none', cursor: 'pointer', padding: '14px 24px', borderRadius: 11, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 20px rgba(16,185,129,0.28)' }}><Plus size={18} /> Создать новый клип</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(264px, 1fr))', gap: 22 }}>
        {MOCK.map(p => <ProjectCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}
