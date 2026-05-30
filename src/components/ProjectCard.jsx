import { Link } from 'react-router-dom';
import { Film, Check } from 'lucide-react';
import { C } from '../lib/theme.js';

export default function ProjectCard({ project }) {
  const brief = typeof project.brief === 'string' ? JSON.parse(project.brief) : project.brief;
  const hasVideo = !!(brief?.video_url || project.result_url);
  const thumbUrl = brief?.image_url;
  const date = new Date(project.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  return (
    <Link to={`/project/${project.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: C.glassBg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${C.gray200}`, borderRadius: 18, overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer', height: '100%',
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
      </div>
    </Link>
  );
}
