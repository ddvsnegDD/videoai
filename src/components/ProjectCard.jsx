import { Link } from 'react-router-dom';
import { Film, Clock, Image } from 'lucide-react';
import { C } from '../lib/theme.js';

export default function ProjectCard({ project }) {
  const brief = typeof project.brief === 'string' ? JSON.parse(project.brief) : project.brief;
  const hasScenario = !!brief?.selectedScenario;
  const hasStoryboard = brief?.scenes_media?.length > 0;
  const date = new Date(project.created_at).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short',
  });

  const statusLabel = hasStoryboard ? 'Раскадровка' : hasScenario ? 'Сценарий готов' : 'Черновик';
  const statusActive = hasScenario;

  // Show first scene image as card thumbnail
  const thumbUrl = hasStoryboard ? brief.scenes_media.find(s => s.image_url)?.image_url : null;

  return (
    <Link to={`/project/${project.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: C.glassBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${C.gray200}`,
        borderRadius: 18,
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        height: '100%',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = C.shadowMd;
          e.currentTarget.style.borderColor = C.gray300;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.borderColor = C.gray200;
          e.currentTarget.style.transform = 'none';
        }}
      >
        {/* Thumbnail */}
        {thumbUrl && (
          <div style={{
            width: '100%',
            height: 120,
            overflow: 'hidden',
            background: C.gray100,
          }}>
            <img
              src={thumbUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: statusActive ? C.primaryLight : C.gray100,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {hasStoryboard
                ? <Image size={16} color={C.primary} />
                : <Film size={16} color={statusActive ? C.primary : C.gray400} />}
            </div>
            <span style={{
              fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 5,
              background: statusActive ? C.primaryLight : C.gray100,
              color: statusActive ? C.primaryDark : C.gray500,
            }}>
              {statusLabel}
            </span>
          </div>

          <h3 style={{
            fontFamily: "'Manrope', sans-serif", fontSize: '1rem', fontWeight: 700,
            color: C.dark, marginBottom: 6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {project.title}
          </h3>

          {brief?.topic && (
            <p style={{
              color: C.gray500, fontSize: '0.8125rem', lineHeight: 1.5, marginBottom: 12,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {brief.topic}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: C.gray400, fontSize: '0.75rem' }}>
            <span>{date}</span>
            {brief?.duration && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} /> {brief.duration}с
              </span>
            )}
            {hasStoryboard && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.primary }}>
                <Image size={11} /> {brief.scenes_media.filter(s => s.image_url).length} фото
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
