import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Film, Clock, Info } from 'lucide-react';
import { C } from '../lib/theme.js';
import { api } from '../lib/api.js';
import Btn from '../components/Btn.jsx';

export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/projects/${id}`)
      .then(data => setProject(data.project))
      .catch(() => navigate('/dashboard', { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!project) return null;

  const brief = typeof project.brief === 'string' ? JSON.parse(project.brief) : project.brief;
  const scenario = brief?.selectedScenario;
  const totalSec = scenario?.scenes?.reduce((s, sc) => s + sc.duration_sec, 0) || 0;

  return (
    <div style={{ paddingTop: 96, paddingBottom: 80, minHeight: '100vh', background: C.bg }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none',
            border: 'none', cursor: 'pointer', color: C.gray500, fontSize: '0.8125rem',
            padding: 0, marginBottom: 24,
          }}
        >
          <ArrowLeft size={14} /> Назад в кабинет
        </button>

        <h1 style={{
          fontFamily: "'Manrope', sans-serif", fontSize: '1.75rem', fontWeight: 700,
          color: C.dark, marginBottom: 8,
        }}>
          {project.title}
        </h1>

        {/* Brief info */}
        <div style={{
          display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap',
        }}>
          {brief?.style && brief.style !== 'Без предпочтений' && (
            <Tag icon={<Info size={12} />} text={brief.style} />
          )}
          {brief?.duration && (
            <Tag icon={<Clock size={12} />} text={`${brief.duration} сек`} />
          )}
          <Tag icon={<Film size={12} />} text={project.status === 'draft' ? 'Черновик' : project.status} />
        </div>

        {/* Selected scenario */}
        {scenario ? (
          <div style={{
            background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20,
            padding: 32, marginBottom: 24,
          }}>
            <h2 style={{
              fontFamily: "'Manrope', sans-serif", fontSize: '1.25rem', fontWeight: 700,
              color: C.dark, marginBottom: 6,
            }}>
              {scenario.title}
            </h2>
            <p style={{ color: C.gray500, fontSize: '0.9375rem', marginBottom: 24, lineHeight: 1.6 }}>
              {scenario.description}
            </p>

            <div style={{ background: C.gray100, borderRadius: 14, padding: 16, marginBottom: 24 }}>
              {scenario.scenes.map((scene, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, padding: '12px 0',
                  borderBottom: i < scenario.scenes.length - 1 ? `1px solid ${C.gray200}` : 'none',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, background: C.white,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8125rem', fontWeight: 700, color: C.primary, flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', color: C.dark, lineHeight: 1.5 }}>
                      {scene.description}
                    </p>
                  </div>
                  <span style={{ color: C.gray400, fontSize: '0.8125rem', flexShrink: 0 }}>
                    {scene.duration_sec}с
                  </span>
                </div>
              ))}
            </div>

            <p style={{ color: C.gray400, fontSize: '0.8125rem', marginBottom: 20 }}>
              Общая длительность: {totalSec} сек
            </p>

            <Btn
              variant="primary"
              size="lg"
              style={{ width: '100%' }}
              onClick={() => {
                // TODO: Sprint 3-4 — video generation
                alert('Генерация видео будет доступна в следующих спринтах');
              }}
            >
              <Film size={18} /> Создать видео из этого сценария
            </Btn>
          </div>
        ) : (
          <div style={{
            background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20,
            padding: '48px 32px', textAlign: 'center',
          }}>
            <p style={{ color: C.gray500, marginBottom: 16 }}>Сценарий ещё не выбран</p>
            <Link to="/editor">
              <Btn variant="primary" size="md">Создать сценарий</Btn>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Tag({ icon, text }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 12px', borderRadius: 8,
      background: C.gray100, color: C.gray600,
      fontSize: '0.8125rem', fontWeight: 500,
    }}>
      {icon} {text}
    </span>
  );
}
