import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Sparkles, CreditCard, Film } from 'lucide-react';
import { C } from '../lib/theme.js';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Btn from '../components/Btn.jsx';
import ProjectCard from '../components/ProjectCard.jsx';

export default function DashboardPage() {
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

  return (
    <div style={{ paddingTop: 96, paddingBottom: 80, minHeight: '100vh', background: C.bg }}>
      <div className="container" style={{ maxWidth: 960 }}>
        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 32, flexWrap: 'wrap', gap: 16,
        }}>
          <div>
            <h1 style={{
              fontFamily: "'Manrope', sans-serif", fontSize: '1.75rem', fontWeight: 700,
              color: C.dark, marginBottom: 4,
            }}>
              Мои проекты
            </h1>
            <p style={{ color: C.gray500, fontSize: '0.9375rem' }}>{user?.email}</p>
          </div>
          <Link to="/editor">
            <Btn variant="primary" size="md">
              <Plus size={18} /> Новый креатив
            </Btn>
          </Link>
        </div>

        {/* Stats cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16, marginBottom: 40,
        }}>
          <StatCard icon={<Sparkles size={20} color={C.primary} />} label="Кредиты" value={user?.credits ?? 0} accent />
          <StatCard icon={<Film size={20} color={C.gray500} />} label="Проекты" value={projects.length} />
          <StatCard icon={<CreditCard size={20} color={C.gray500} />} label="Тариф" value="Бесплатный" link="/billing" />
        </div>

        {deleteError && (
          <p style={{ color: '#EF4444', fontSize: '0.8125rem', textAlign: 'center', marginBottom: 16, fontWeight: 500 }}>
            {deleteError}
          </p>
        )}

        {/* Projects */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div className="spinner" />
          </div>
        ) : projects.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {projects.map(p => <ProjectCard key={p.id} project={p} onDelete={handleDelete} />)}
          </div>
        ) : (
          <div style={{
            background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20,
            padding: '64px 32px', textAlign: 'center',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16, background: C.primaryLight,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <Film size={28} color={C.primary} />
            </div>
            <h2 style={{
              fontFamily: "'Manrope', sans-serif", fontSize: '1.25rem', fontWeight: 700,
              color: C.dark, marginBottom: 8,
            }}>
              Создайте первый проект
            </h2>
            <p style={{
              color: C.gray500, fontSize: '0.9375rem', maxWidth: 400,
              margin: '0 auto 24px', lineHeight: 1.6,
            }}>
              Загрузите фото товара — AI оживит его в рекламный видеокреатив за пару минут
            </p>
            <Link to="/editor">
              <Btn variant="primary" size="lg">
                <Plus size={18} /> Создать креатив
              </Btn>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent, link }) {
  const content = (
    <div style={{
      background: C.white, border: `1px solid ${accent ? C.primary + '30' : C.gray200}`,
      borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center',
      gap: 16, transition: 'box-shadow 0.2s, border-color 0.2s',
      cursor: link ? 'pointer' : 'default',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: accent ? C.primaryLight : C.gray100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontSize: '0.75rem', fontWeight: 500, color: C.gray400,
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2,
        }}>{label}</div>
        <div style={{
          fontSize: '1.25rem', fontWeight: 700, fontFamily: "'Manrope', sans-serif",
          color: accent ? C.primary : C.dark,
        }}>{value}</div>
      </div>
    </div>
  );
  if (link) return <Link to={link} style={{ textDecoration: 'none' }}>{content}</Link>;
  return content;
}
