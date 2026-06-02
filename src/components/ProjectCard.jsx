import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, Check, Trash2 } from 'lucide-react';
import { C } from '../lib/theme.js';

export default function ProjectCard({ project, onDelete }) {
  const brief = typeof project.brief === 'string' ? JSON.parse(project.brief) : project.brief;
  const hasVideo = !!(brief?.video_url || project.result_url);
  const thumbUrl = brief?.image_url;
  const date = new Date(project.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const [confirming, setConfirming] = useState(false);

  function handleDeleteClick(e) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(true);
  }

  function handleConfirm(e) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(false);
    onDelete?.(project.id);
  }

  function handleCancel(e) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(false);
  }

  return (
    <Link to={`/project/${project.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: C.glassBg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${C.gray200}`, borderRadius: 18, overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer', height: '100%',
        position: 'relative',
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = C.shadowMd; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
      >
        {thumbUrl && (
          <div style={{ width: '100%', height: 140, overflow: 'hidden', background: C.gray100, position: 'relative' }}>
            <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {hasVideo && (
              <div style={{
                position: 'absolute', bottom: 8, right: 8,
                background: 'rgba(16, 185, 129, 0.9)', borderRadius: 6,
                padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4,
                fontSize: '0.625rem', fontWeight: 700, color: '#fff',
              }}>
                <Check size={10} /> MP4
              </div>
            )}
          </div>
        )}

        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: hasVideo ? C.primaryLight : C.gray100,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Film size={14} color={hasVideo ? C.primary : C.gray400} />
            </div>
            <span style={{
              fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 5,
              background: hasVideo ? C.primaryLight : C.gray100,
              color: hasVideo ? C.primaryDark : C.gray500,
            }}>
              {hasVideo ? 'Готово' : 'Черновик'}
            </span>
            <div style={{ flex: 1 }} />
            {onDelete && (
              <button
                onClick={handleDeleteClick}
                title="Удалить"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  color: C.gray400, borderRadius: 6, transition: 'color 0.15s',
                  display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                onMouseLeave={e => e.currentTarget.style.color = C.gray400}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <h3 style={{
            fontFamily: "'Manrope', sans-serif", fontSize: '0.9375rem', fontWeight: 700,
            color: C.dark, marginBottom: 6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {project.title}
          </h3>

          <span style={{ color: C.gray400, fontSize: '0.75rem' }}>{date}</span>
        </div>

        {/* Confirmation overlay */}
        {confirming && (
          <div
            onClick={handleCancel}
            style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12, borderRadius: 18, zIndex: 10, padding: 20,
            }}
          >
            <p style={{ color: '#fff', fontSize: '0.8125rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>
              Удалить креатив?<br />
              <span style={{ fontWeight: 400, fontSize: '0.75rem', opacity: 0.8 }}>
                Видео и файлы удалятся безвозвратно
              </span>
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleConfirm}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: '#EF4444', color: '#fff', fontSize: '0.75rem', fontWeight: 600,
                }}
              >
                Удалить
              </button>
              <button
                onClick={handleCancel}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)',
                  cursor: 'pointer', background: 'transparent', color: '#fff',
                  fontSize: '0.75rem', fontWeight: 600,
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
