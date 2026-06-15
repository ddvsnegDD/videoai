// src/pages/DashboardPage.jsx
// Sprint C merge: новый дизайн карточек + реальные данные из API
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Plus, Download, Trash2, Sparkles, Clock, Film, Loader } from 'lucide-react';
import { C } from '../lib/theme';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const glassPanel = {
  background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(16,185,129,0.12)', borderRadius: 20,
  boxShadow: '0 16px 32px rgba(10,46,31,0.03)', padding: 24,
};

function ProjectCard({ p, onDelete }) {
  const navigate = useNavigate();
  const v = useRef(null);
  const [hovered, setHovered] = useState(false);
  const brief = typeof p.brief === 'string' ? JSON.parse(p.brief) : (p.brief || {});
  const videoUrl = brief?.video_url || p.result_url;
  const thumbUrl = brief?.image_url;
  const hasVideo = !!videoUrl;
  const modelKey = brief?.model || 'wan';
  const modelLabel = modelKey === 'veo' ? 'Veo 3.1' : modelKey === 'cosmos' ? 'Cosmos' : 'Kling 2.5';
  const modelBadgeBg = modelKey === 'veo' ? 'rgba(99,102,241,0.92)' : modelKey === 'cosmos' ? 'rgba(245,158,11,0.92)' : 'rgba(10,46,31,0.82)';
  const date = p.created_at
    ? new Date(p.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const el = v.current;
    if (!el) return;
    const seek = () => { try { el.currentTime = 2.3; } catch (e) {} };
    el.addEventListener('loadeddata', seek);
    return () => el.removeEventListener('loadeddata', seek);
  }, [videoUrl]);

  return (
    <div
      onClick={() => navigate(`/project/${p.id}`)}
      onMouseEnter={() => { setHovered(true); v.current?.play().catch(() => {}); }}
      onMouseLeave={() => { setHovered(false); if (v.current) { v.current.pause(); try { v.current.currentTime = 2.3; } catch {} } }}
      style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2EAE6', overflow: 'hidden', boxShadow: hovered ? '0 8px 24px rgba(10,46,31,0.10)' : '0 4px 12px rgba(10,46,31,0.03)', position: 'relative', cursor: 'pointer', transition: 'box-shadow 0.2s ease, transform 0.2s ease', transform: hovered ? 'translateY(-2px)' : 'none' }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: '#0a1f16', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        {hasVideo ? (
          <>
            <video ref={v} src={videoUrl} muted loop playsInline preload="auto" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'relative', zIndex: 2, width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', display: 'grid', placeItems: 'center', color: C.dark, boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
              <Video size={16} fill="currentColor" style={{ marginLeft: 2 }} />
            </div>
          </>
        ) : thumbUrl ? (
          <img src={thumbUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ textAlign: 'center', color: '#94A3B8' }}>
            <Clock size={26} color={C.primary} style={{ animation: 'va-spin 2s linear infinite' }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 6 }}>Рендеринг ИИ...</div>
          </div>
        )}
        <div style={{ position: 'absolute', top: 11, left: 11, zIndex: 3, background: modelBadgeBg, color: '#fff', padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{modelLabel}</div>
      </div>

      <div style={{ padding: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', color: C.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</h3>
        <div style={{ fontSize: 12.5, color: '#6B7F74', marginBottom: 14 }}>{date}</div>
        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
          {hasVideo ? (
            <a href={videoUrl} download target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, textDecoration: 'none' }}>
              <button style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: '#F1F5F9', color: C.dark, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Download size={14} /> Скачать MP4</button>
            </a>
          ) : (
            <button disabled style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#F1F5F9', color: '#94A3B8', fontWeight: 600, fontSize: 13, cursor: 'not-allowed' }}>В процессе...</button>
          )}
          <button
            onClick={e => { e.stopPropagation(); setConfirming(true); }}
            style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.07)', color: '#EF4444', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          ><Trash2 size={14} /></button>
        </div>
      </div>

      {/* Delete confirmation overlay */}
      {confirming && (
        <div
          onClick={e => { e.stopPropagation(); setConfirming(false); }}
          style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, borderRadius: 16, zIndex: 10, padding: 20,
          }}
        >
          <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>
            Удалить креатив?<br />
            <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.8 }}>Видео и файлы удалятся безвозвратно</span>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={e => { e.stopPropagation(); setConfirming(false); onDelete(p.id); }}
              style={{ padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#EF4444', color: '#fff', fontSize: 12, fontWeight: 600 }}
            >Удалить</button>
            <button
              onClick={e => { e.stopPropagation(); setConfirming(false); }}
              style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 600 }}
            >Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    api.get('/projects')
      .then(data => setProjects(data.projects || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(projectId) {
    setDeleteError('');
    try {
      await api.del(`/projects/${projectId}`);
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (err) {
      if (err.status === 409) {
        setDeleteError('Дождитесь завершения генерации');
      } else {
        setDeleteError('Ошибка удаления');
      }
      setTimeout(() => setDeleteError(''), 4000);
    }
  }

  const credits = user?.credits ?? 0;
  const freeWan = user?.free_wan ?? 0;
  const freeVeo = user?.free_veo ?? 0;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '36px 24px 64px' }}>
      <style>{`@keyframes va-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header panel */}
      <div style={{ ...glassPanel, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 24, fontWeight: 800, margin: '0 0 4px', color: C.dark, letterSpacing: '-0.02em' }}>Мои видеокреативы</h1>
            <p style={{ margin: 0, fontSize: 13.5, color: '#46594F' }}>Архив готовых рекламных материалов для маркетплейсов</p>
          </div>
          <div style={{ display: 'flex', gap: 28, borderLeft: '1px solid #E2E8F0', paddingLeft: 32 }}>
            <div>
              <div style={{ color: '#6B7F74', fontSize: 12, marginBottom: 3 }}>Доступный баланс</div>
              <div style={{ fontWeight: 800, color: C.dark, display: 'flex', alignItems: 'center', gap: 5, fontSize: 16, fontFamily: '"Manrope", sans-serif' }}><Sparkles size={14} color={C.primary} /> {credits} кредитов</div>
            </div>
            <div>
              <div style={{ color: '#6B7F74', fontSize: 12, marginBottom: 3 }}>Пробные попытки</div>
              <div style={{ fontWeight: 700, color: C.primaryDark, fontSize: 14, marginTop: 2 }}>
                {freeWan > 0 ? `${freeWan} Kling` : ''}{freeWan > 0 && freeVeo > 0 ? ' · ' : ''}{freeVeo > 0 ? `${freeVeo} Veo` : ''}{freeWan === 0 && freeVeo === 0 ? 'Использованы' : ''}
              </div>
            </div>
          </div>
        </div>
        <button onClick={() => navigate('/editor')} style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: '#fff', border: 'none', cursor: 'pointer', padding: '14px 24px', borderRadius: 11, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 20px rgba(16,185,129,0.28)' }}><Plus size={18} /> Создать новый клип</button>
      </div>

      {deleteError && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 16px', marginBottom: 20, color: '#991B1B', fontSize: 14, fontWeight: 500, textAlign: 'center' }}>
          {deleteError}
        </div>
      )}

      {/* Projects grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
          <Loader size={32} color={C.primary} style={{ animation: 'va-spin 1s linear infinite' }} />
        </div>
      ) : projects.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(264px, 1fr))', gap: 22 }}>
          {projects.map(p => <ProjectCard key={p.id} p={p} onDelete={handleDelete} />)}
        </div>
      ) : (
        <div style={{ ...glassPanel, textAlign: 'center', padding: '64px 32px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F1F5F9', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: '#64748B' }}><Film size={28} /></div>
          <h2 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 20, fontWeight: 800, color: C.dark, marginBottom: 8 }}>Создайте первый проект</h2>
          <p style={{ fontSize: 14, color: '#6B7F74', maxWidth: 400, margin: '0 auto 24px', lineHeight: 1.5 }}>
            Загрузите фото товара — AI оживит его в рекламный видеокреатив за пару минут
          </p>
          <button onClick={() => navigate('/editor')} style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: '#fff', border: 'none', cursor: 'pointer', padding: '14px 28px', borderRadius: 11, fontSize: 16, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 10px 24px rgba(16,185,129,0.28)' }}><Plus size={18} /> Создать креатив</button>
        </div>
      )}
    </div>
  );
}
