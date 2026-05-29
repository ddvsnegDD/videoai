import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Film, Clock, Info, Mic, Sparkles, RefreshCw, ImageIcon } from 'lucide-react';
import { C } from '../lib/theme.js';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useJobPolling } from '../lib/hooks.js';
import { VOICES } from '../data/voices.js';
import Btn from '../components/Btn.jsx';
import GenerationProgress from '../components/GenerationProgress.jsx';
import Storyboard from '../components/Storyboard.jsx';

const DEFAULT_VIDEO_COST = 25;
const DEFAULT_REGEN_COST = 3;

export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refresh } = useAuth();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voice, setVoice] = useState('alena');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState(null);
  const { job } = useJobPolling(jobId);
  const [config, setConfig] = useState(null);

  // Load server config (credits costs)
  useEffect(() => {
    api.get('/config')
      .then(setConfig)
      .catch(() => setConfig({ CREDITS_PER_VIDEO: DEFAULT_VIDEO_COST, CREDITS_PER_REGEN: DEFAULT_REGEN_COST }));
  }, []);

  useEffect(() => {
    api.get(`/projects/${id}`)
      .then(data => setProject(data.project))
      .catch(() => navigate('/dashboard', { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const reloadProject = useCallback(() => {
    api.get(`/projects/${id}`)
      .then(data => setProject(data.project))
      .catch(() => {});
  }, [id]);

  // When storyboard job completes — save result to project brief
  useEffect(() => {
    if (!job || !project) return;

    if (job.status === 'done' || job.status === 'failed') {
      refresh();
    }

    if (job.status === 'done' && job.output?.scenes_media) {
      const brief = typeof project.brief === 'string' ? JSON.parse(project.brief) : project.brief;
      api.patch(`/projects/${id}`, {
        brief: {
          ...brief,
          scenes_media: job.output.scenes_media,
          voice: job.output.voice || voice,
        },
      })
        .then(data => setProject(data.project))
        .catch(err => console.error('Failed to save storyboard:', err));
    }

    // Handle regenerate_scene completion
    if (job.status === 'done' && job.output?.sceneIndex !== undefined) {
      const brief = typeof project.brief === 'string' ? JSON.parse(project.brief) : project.brief;
      const scenesMedia = [...(brief.scenes_media || [])];
      const idx = job.output.sceneIndex;
      if (scenesMedia[idx]) {
        scenesMedia[idx] = {
          ...scenesMedia[idx],
          image_url: job.output.image_url || scenesMedia[idx].image_url,
          audio_url: job.output.audio_url || scenesMedia[idx].audio_url,
          ok: !!(job.output.image_url && job.output.audio_url),
        };
        api.patch(`/projects/${id}`, {
          brief: { ...brief, scenes_media: scenesMedia },
        })
          .then(data => {
            setProject(data.project);
            setJobId(null);
          })
          .catch(err => console.error('Failed to save regen result:', err));
      }
    }
  }, [job?.status]);

  if (loading || !config) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!project) return null;

  const videoCost = config.CREDITS_PER_VIDEO || DEFAULT_VIDEO_COST;
  const regenCost = config.CREDITS_PER_REGEN || DEFAULT_REGEN_COST;
  const brief = typeof project.brief === 'string' ? JSON.parse(project.brief) : project.brief;
  const scenario = brief?.selectedScenario;
  const scenesMedia = brief?.scenes_media;
  const totalSec = scenario?.scenes?.reduce((s, sc) => s + sc.duration_sec, 0) || 0;
  const scenesCount = scenario?.scenes?.length || 0;
  const credits = user?.credits ?? 0;
  const hasStoryboard = scenesMedia && scenesMedia.length > 0;

  // Debug
  console.log('[ProjectPage] brief:', JSON.stringify({
    hasScenario: !!scenario,
    scenesCount,
    hasStoryboard,
    hasScenesMedia: !!scenesMedia,
    scenesMediaLength: scenesMedia?.length,
    voice: brief?.voice,
    briefKeys: brief ? Object.keys(brief) : null,
  }));

  async function handleGenerateStoryboard() {
    if (!scenario) return;
    setGenerating(true);
    setError('');

    try {
      const res = await api.post('/jobs', {
        projectId: Number(id),
        type: 'storyboard',
        input: {
          scenario,
          voice,
          style: brief?.style,
        },
      });
      setJobId(res.jobId);
      refresh();
    } catch (err) {
      if (err.data?.error === 'INSUFFICIENT_CREDITS') {
        setError(`Недостаточно кредитов. Нужно ${videoCost} кредитов.`);
      } else {
        setError('Ошибка при создании задачи');
      }
    } finally {
      setGenerating(false);
    }
  }

  function handleRetryStoryboard() {
    setJobId(null);
    setError('');
    refresh();
  }

  async function handleRegenerateScene(sceneIndex) {
    if (!scenario || !scenesMedia) return;
    const scene = scenario.scenes[sceneIndex];
    if (!scene) return;

    try {
      const res = await api.post('/jobs', {
        projectId: Number(id),
        type: 'regenerate_scene',
        input: {
          sceneIndex,
          scene,
          voice: brief?.voice || 'alena',
          tone: scenario.tone,
          style: brief?.style,
        },
      });
      setJobId(res.jobId);
      refresh();
    } catch (err) {
      if (err.data?.error === 'INSUFFICIENT_CREDITS') {
        alert(`Недостаточно кредитов. Нужно ${regenCost}.`);
      } else {
        alert('Ошибка при перегенерации сцены');
      }
    }
  }

  const isRegenJob = jobId && job?.status && job.output?.sceneIndex !== undefined;

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
          <Tag icon={<Film size={12} />} text={hasStoryboard ? 'Раскадровка готова' : scenario ? 'Сценарий выбран' : 'Черновик'} />
          {brief?.voice && (
            <Tag icon={<Mic size={12} />} text={VOICES.find(v => v.id === brief.voice)?.label?.split(' (')[0] || brief.voice} />
          )}
        </div>

        {/* Selected scenario */}
        {scenario && (
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

            {/* Scene list (text only — shown when no storyboard yet) */}
            {!hasStoryboard && !jobId && (
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
            )}

            <p style={{ color: C.gray400, fontSize: '0.8125rem', marginBottom: 20 }}>
              {scenesCount} сцен · {totalSec} сек
            </p>

            {/* Storyboard generation block — show when no storyboard and no active job */}
            {!hasStoryboard && !jobId && (
              <div style={{
                background: C.bgMint,
                border: `1px solid rgba(16, 185, 129, 0.12)`,
                borderRadius: 16,
                padding: 24,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, background: C.primaryLight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ImageIcon size={20} color={C.primaryDark} />
                  </div>
                  <div>
                    <h3 style={{
                      fontFamily: "'Manrope', sans-serif", fontSize: '1rem', fontWeight: 700,
                      color: C.dark, marginBottom: 2,
                    }}>
                      Создать раскадровку
                    </h3>
                    <p style={{ color: C.gray500, fontSize: '0.8125rem' }}>
                      AI нарисует картинки и озвучит каждую сцену
                    </p>
                  </div>
                </div>

                {/* Voice selector */}
                <div style={{ marginBottom: 16 }}>
                  <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Mic size={14} /> Голос озвучки
                  </label>
                  <select
                    className="input"
                    value={voice}
                    onChange={e => setVoice(e.target.value)}
                  >
                    {VOICES.map(v => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>

                {error && (
                  <p style={{ color: C.danger, fontSize: '0.8125rem', marginBottom: 12 }}>
                    {error}
                  </p>
                )}

                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 12,
                }}>
                  <p style={{ color: C.gray400, fontSize: '0.8125rem' }}>
                    Создание ролика: <strong style={{ color: C.primary }}>{videoCost} кредитов</strong>.
                    У вас: <strong>{credits}</strong>
                  </p>
                  <Btn
                    variant="primary"
                    size="md"
                    disabled={generating || credits < videoCost}
                    onClick={handleGenerateStoryboard}
                  >
                    {generating ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                        Создаём...
                      </span>
                    ) : (
                      <><Sparkles size={16} /> Озвучить и нарисовать сцены</>
                    )}
                  </Btn>
                </div>
              </div>
            )}

            {/* Active storyboard job — progress */}
            {jobId && (!job || job.status === 'pending' || job.status === 'running') && !isRegenJob && (
              <div style={{
                background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 16,
              }}>
                <GenerationProgress job={job} type="storyboard" />
              </div>
            )}

            {/* Storyboard job failed */}
            {jobId && job?.status === 'failed' && !isRegenJob && (
              <div style={{
                background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 16,
              }}>
                <GenerationProgress job={job} type="storyboard" />
                <div style={{ padding: '0 32px 32px', textAlign: 'center' }}>
                  <Btn variant="outline" size="md" onClick={handleRetryStoryboard}>
                    <RefreshCw size={16} /> Попробовать снова
                  </Btn>
                </div>
              </div>
            )}

            {/* Storyboard job completed inline (before saving to project) */}
            {jobId && job?.status === 'done' && job.output?.scenes_media && !hasStoryboard && (
              <Storyboard
                scenes={scenario.scenes}
                scenesMedia={job.output.scenes_media}
                credits={credits}
                regenCost={regenCost}
                onRegenerate={handleRegenerateScene}
              />
            )}
          </div>
        )}

        {/* Saved storyboard display */}
        {hasStoryboard && scenario && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16, flexWrap: 'wrap', gap: 12,
            }}>
              <h2 style={{
                fontFamily: "'Manrope', sans-serif", fontSize: '1.25rem', fontWeight: 700,
                color: C.dark,
              }}>
                Раскадровка
              </h2>
            </div>
            <Storyboard
              scenes={scenario.scenes}
              scenesMedia={scenesMedia}
              credits={credits}
              regenCost={regenCost}
              onRegenerate={handleRegenerateScene}
              regeneratingIndex={jobId && job && (job.status === 'pending' || job.status === 'running') ? job.output?.sceneIndex ?? null : null}
            />

            <div style={{ marginTop: 24 }}>
              <Btn
                variant="primary"
                size="lg"
                style={{ width: '100%' }}
                onClick={() => {
                  alert('Монтаж видео будет доступен в следующих спринтах');
                }}
              >
                <Film size={18} /> Собрать видео из раскадровки
              </Btn>
            </div>
          </div>
        )}

        {/* No scenario */}
        {!scenario && (
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
