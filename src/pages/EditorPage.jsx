import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Clock, Palette, RefreshCw, ArrowLeft, Check } from 'lucide-react';
import { C } from '../lib/theme.js';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useJobPolling } from '../lib/hooks.js';
import Btn from '../components/Btn.jsx';
import GenerationProgress from '../components/GenerationProgress.jsx';

const STYLES = ['Без предпочтений', 'Уютный', 'Энергичный', 'Премиальный'];
const DURATIONS = [
  { label: '15 сек', value: 15 },
  { label: '30 сек', value: 30 },
  { label: '60 сек', value: 60 },
];

export default function EditorPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('Без предпочтений');
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [projectId, setProjectId] = useState(null);
  const [jobId, setJobId] = useState(null);
  const { job } = useJobPolling(jobId);

  const step = jobId ? 2 : 1;
  const credits = user?.credits ?? 0;

  async function handleGenerate(e) {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError('');

    try {
      const proj = await api.post('/projects', {
        title: topic.trim().slice(0, 50),
        brief: { topic: topic.trim(), style, duration },
      });
      const pid = proj.project.id;
      setProjectId(pid);

      const res = await api.post('/jobs', {
        projectId: pid,
        type: 'script',
        input: { topic: topic.trim(), style, duration },
      });
      setJobId(res.jobId);
      refresh();
    } catch (err) {
      if (err.data?.error === 'INSUFFICIENT_CREDITS') {
        setError('Недостаточно кредитов. Пополните баланс.');
      } else {
        setError('Ошибка при создании задачи');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectScenario(scenario) {
    try {
      await api.patch(`/projects/${projectId}`, {
        brief: { topic: topic.trim(), style, duration, selectedScenario: scenario, scenarios: job.output.scenarios },
      });
    } catch {}
    navigate(`/project/${projectId}`);
  }

  function handleRetry() {
    setJobId(null);
    setProjectId(null);
    setError('');
    refresh();
  }

  return (
    <div style={{ paddingTop: 96, paddingBottom: 80, minHeight: '100vh', background: C.bg }}>
      <div className="container" style={{ maxWidth: 800 }}>

        {step === 1 && (
          <>
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
              Новое видео
            </h1>
            <p style={{ color: C.gray500, fontSize: '0.9375rem', marginBottom: 32 }}>
              Опишите тему — AI придумает 3 варианта сценария
            </p>

            <form onSubmit={handleGenerate}>
              <div style={{
                background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20,
                padding: 32, marginBottom: 24,
              }}>
                <label className="label">О чём видео?</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Например: новый осенний латте в кофейне"
                  value={topic}
                  onChange={e => { setTopic(e.target.value); setError(''); }}
                  style={{ resize: 'vertical', marginBottom: 20 }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Palette size={14} /> Стиль
                    </label>
                    <select className="input" value={style} onChange={e => setStyle(e.target.value)}>
                      {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} /> Длительность
                    </label>
                    <select className="input" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                      {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {error && (
                <p style={{ color: C.danger, fontSize: '0.8125rem', marginBottom: 16, textAlign: 'center' }}>
                  {error}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <p style={{ color: C.gray400, fontSize: '0.8125rem' }}>
                  Стоимость: <strong style={{ color: C.primary }}>1 кредит</strong>. У вас: <strong>{credits}</strong>
                </p>
                <Btn variant="primary" size="lg" disabled={loading || !topic.trim() || credits < 1}>
                  {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                      Создаём...
                    </span>
                  ) : (
                    <><Sparkles size={18} /> Придумать сценарии</>
                  )}
                </Btn>
              </div>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <button
              onClick={handleRetry}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'none',
                border: 'none', cursor: 'pointer', color: C.gray500, fontSize: '0.8125rem',
                padding: 0, marginBottom: 24,
              }}
            >
              <ArrowLeft size={14} /> Новый запрос
            </button>

            <h1 style={{
              fontFamily: "'Manrope', sans-serif", fontSize: '1.75rem', fontWeight: 700,
              color: C.dark, marginBottom: 8,
            }}>
              Сценарии
            </h1>
            <p style={{ color: C.gray500, fontSize: '0.9375rem', marginBottom: 32 }}>
              Тема: <strong style={{ color: C.dark }}>{topic}</strong>
            </p>

            {(!job || job.status === 'pending' || job.status === 'running') && (
              <div style={{
                background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20,
              }}>
                <GenerationProgress job={job} />
              </div>
            )}

            {job?.status === 'done' && job.output?.scenarios && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {job.output.scenarios.map((scenario, i) => (
                  <ScenarioCard
                    key={i}
                    scenario={scenario}
                    index={i}
                    onSelect={() => handleSelectScenario(scenario)}
                  />
                ))}
              </div>
            )}

            {job?.status === 'failed' && (
              <div style={{
                background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20,
              }}>
                <GenerationProgress job={job} />
                <div style={{ padding: '0 32px 32px', textAlign: 'center' }}>
                  <Btn variant="outline" size="md" onClick={handleRetry}>
                    <RefreshCw size={16} /> Попробовать снова
                  </Btn>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const TONE_LABELS = ['Уютный', 'Энергичный', 'Премиальный'];
const TONE_COLORS = ['#F59E0B', '#EF4444', '#8B5CF6'];

function ScenarioCard({ scenario, index, onSelect }) {
  const totalSec = scenario.scenes.reduce((s, sc) => s + sc.duration_sec, 0);

  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.gray200}`,
      borderRadius: 20,
      padding: 28,
      transition: 'box-shadow 0.2s, border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{
          fontSize: '0.6875rem', fontWeight: 600, padding: '3px 10px', borderRadius: 6,
          background: TONE_COLORS[index] + '18', color: TONE_COLORS[index],
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {TONE_LABELS[index] || `Вариант ${index + 1}`}
        </span>
        <span style={{ color: C.gray400, fontSize: '0.75rem' }}>{totalSec} сек</span>
      </div>

      <h3 style={{
        fontFamily: "'Manrope', sans-serif", fontSize: '1.125rem', fontWeight: 700,
        color: C.dark, marginBottom: 6,
      }}>
        {scenario.title}
      </h3>
      <p style={{ color: C.gray500, fontSize: '0.875rem', marginBottom: 20, lineHeight: 1.6 }}>
        {scenario.description}
      </p>

      <div style={{
        background: C.gray100, borderRadius: 14, padding: 16, marginBottom: 20,
      }}>
        {scenario.scenes.map((scene, si) => (
          <div key={si} style={{
            display: 'flex', gap: 12, padding: '10px 0',
            borderBottom: si < scenario.scenes.length - 1 ? `1px solid ${C.gray200}` : 'none',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: C.white,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 700, color: C.gray500, flexShrink: 0,
            }}>
              {si + 1}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.8125rem', color: C.dark, lineHeight: 1.5 }}>
                {scene.description}
              </p>
            </div>
            <span style={{ color: C.gray400, fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {scene.duration_sec}с
            </span>
          </div>
        ))}
      </div>

      <Btn variant="primary" size="md" onClick={onSelect} style={{ width: '100%' }}>
        <Check size={16} /> Выбрать этот сценарий
      </Btn>
    </div>
  );
}
