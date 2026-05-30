import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw, Film, Clock, Play } from 'lucide-react';
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
  const videoUrl = brief?.video_url || project.result_url;
  const imageUrl = brief?.image_url;
  const date = new Date(project.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ paddingTop: 96, paddingBottom: 80, minHeight: '100vh', background: C.bg }}>
      <div className="container" style={{ maxWidth: 640 }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: C.gray500, fontSize: '0.8125rem', padding: 0, marginBottom: 24 }}
        >
          <ArrowLeft size={14} /> Назад в кабинет
        </button>

        <h1 style={{ fontFamily: "'Manrope', sans-serif", fontSize: '1.75rem', fontWeight: 700, color: C.dark, marginBottom: 8 }}>
          {project.title}
        </h1>
        <p style={{ color: C.gray400, fontSize: '0.8125rem', marginBottom: 32 }}>{date}</p>

        {videoUrl ? (
          <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20, padding: 24, textAlign: 'center', marginBottom: 24 }}>
            <video
              controls
              src={videoUrl}
              poster={imageUrl}
              style={{ width: '100%', maxWidth: 400, borderRadius: 16, marginBottom: 20, background: '#000' }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={videoUrl} download target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <Btn variant="primary" size="md">
                  <Download size={16} /> Скачать MP4
                </Btn>
              </a>
              <Link to="/editor" style={{ textDecoration: 'none' }}>
                <Btn variant="outline" size="md">
                  <RefreshCw size={16} /> Создать ещё
                </Btn>
              </Link>
            </div>
          </div>
        ) : imageUrl ? (
          <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20, padding: 32, textAlign: 'center' }}>
            <img src={imageUrl} alt="" style={{ width: '100%', maxWidth: 300, borderRadius: 12, marginBottom: 20 }} />
            <p style={{ color: C.gray500, marginBottom: 16 }}>Видео ещё не создано</p>
            <Link to="/editor" style={{ textDecoration: 'none' }}>
              <Btn variant="primary" size="md">
                <Play size={16} /> Создать креатив
              </Btn>
            </Link>
          </div>
        ) : (
          <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20, padding: '48px 32px', textAlign: 'center' }}>
            <p style={{ color: C.gray500, marginBottom: 16 }}>Проект пуст</p>
            <Link to="/editor" style={{ textDecoration: 'none' }}>
              <Btn variant="primary" size="md">Создать креатив</Btn>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
