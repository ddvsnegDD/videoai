import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Sparkles, ArrowLeft, RefreshCw, Download, Play, Camera, RotateCw, Orbit, Wind, Zap, Crown } from 'lucide-react';
import { C } from '../lib/theme.js';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useJobPolling } from '../lib/hooks.js';
import Btn from '../components/Btn.jsx';
import GenerationProgress from '../components/GenerationProgress.jsx';

const MOTION_ICONS = { push_in: Camera, rotate: RotateCw, orbit: Orbit, float: Wind };

export default function EditorPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [config, setConfig] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [motionKey, setMotionKey] = useState('push_in');
  const [customPrompt, setCustomPrompt] = useState('');
  const [modelKey, setModelKey] = useState('wan');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState(null);
  const { job } = useJobPolling(jobId);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get('/config').then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    if (job?.status === 'done' || job?.status === 'failed') refresh();
  }, [job?.status]);

  const credits = user?.credits ?? 0;
  const freeWan = user?.free_wan ?? 0;
  const freeVeo = user?.free_veo ?? 0;
  const modelCredits = config?.video_models?.[modelKey]?.credits ?? 0;
  const isFree = (modelKey === 'wan' && freeWan > 0) || (modelKey === 'veo' && freeVeo > 0);
  const canAfford = isFree || credits >= modelCredits;

  // Step logic
  const step = jobId
    ? (job?.status === 'done' ? 'result' : 'generating')
    : imageUrl ? 'configure' : 'upload';

  async function handleFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('Максимум 10 МБ'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Только JPG, PNG, WEBP'); return; }

    setImageFile(file);
    setUploading(true);
    setError('');

    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setImageUrl(data.url);
    } catch {
      setError('Ошибка загрузки. Попробуйте ещё раз.');
      setImageFile(null);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }

  async function handleCreate() {
    if (!imageUrl || !config || creating) return;
    setCreating(true);
    setError('');

    try {
      // Create project
      const proj = await api.post('/projects', {
        title: `Креатив ${new Date().toLocaleDateString('ru-RU')}`,
        brief: { source: 'upload', image_url: imageUrl, model: modelKey, motion: motionKey },
      });

      // Create job
      const res = await api.post('/jobs', {
        projectId: proj.project.id,
        type: 'animate',
        input: {
          imageUrl,
          modelKey,
          motionPrompt: customPrompt.trim() || undefined,
          motionKey,
        },
      });
      setJobId(res.jobId);
      refresh();
    } catch (err) {
      if (err.data?.error === 'INSUFFICIENT_CREDITS') {
        setError(`Недостаточно кредитов. Нужно ${modelCredits}.`);
      } else if (err.data?.error === 'TOO_MANY_ACTIVE_JOBS') {
        setError('Уже есть активная генерация. Дождитесь завершения.');
      } else {
        setError('Ошибка создания задачи');
      }
    } finally {
      setCreating(false);
    }
  }

  function handleReset() {
    setJobId(null);
    setImageUrl(null);
    setImageFile(null);
    setError('');
    setCustomPrompt('');
    refresh();
  }

  const videoUrl = job?.output?.video_url;

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
          {step === 'result' ? 'Креатив готов' : 'Новый креатив'}
        </h1>
        <p style={{ color: C.gray500, fontSize: '0.9375rem', marginBottom: 32 }}>
          {step === 'upload' && 'Загрузите фото товара — AI оживит его в короткое видео'}
          {step === 'configure' && 'Настройте движение и выберите модель'}
          {step === 'generating' && 'Генерация...'}
          {step === 'result' && 'Скачайте или создайте ещё'}
        </p>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{
              background: C.white, border: `2px dashed ${C.gray300}`, borderRadius: 20,
              padding: '64px 32px', textAlign: 'center', cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.primary}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.gray300}
          >
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => handleFile(e.target.files?.[0])} />
            {uploading ? (
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 16, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Upload size={28} color={C.primary} />
              </div>
            )}
            <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: '1.125rem', fontWeight: 700, color: C.dark, marginBottom: 8 }}>
              {uploading ? 'Загрузка...' : 'Перетащите фото сюда'}
            </h3>
            <p style={{ color: C.gray400, fontSize: '0.8125rem' }}>
              или нажмите для выбора · JPG, PNG, WEBP · до 10 МБ
            </p>
          </div>
        )}

        {/* STEP 2: Configure */}
        {step === 'configure' && config && (
          <>
            {/* Preview */}
            <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20, padding: 20, marginBottom: 20, display: 'flex', gap: 20, alignItems: 'center' }}>
              <img src={imageUrl} alt="" style={{ width: 100, height: 100, borderRadius: 12, objectFit: 'cover' }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.875rem', color: C.dark, fontWeight: 600, marginBottom: 4 }}>Фото загружено</p>
                <button onClick={() => { setImageUrl(null); setImageFile(null); }} style={{ background: 'none', border: 'none', color: C.gray400, fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}>
                  Заменить
                </button>
              </div>
            </div>

            {/* Motion presets */}
            <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20, padding: 24, marginBottom: 20 }}>
              <label className="label" style={{ marginBottom: 12 }}>Движение</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {config.motion_presets.map(p => {
                  const Icon = MOTION_ICONS[p.key] || Camera;
                  const active = motionKey === p.key && !customPrompt.trim();
                  return (
                    <button key={p.key} onClick={() => { setMotionKey(p.key); setCustomPrompt(''); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
                        borderRadius: 12, border: `1.5px solid ${active ? C.primary : C.gray200}`,
                        background: active ? C.primaryLight : C.white,
                        color: active ? C.primaryDark : C.dark,
                        fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <Icon size={16} /> {p.label}
                    </button>
                  );
                })}
              </div>
              <input
                className="input"
                placeholder="Или свой вариант (англ. промпт)"
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                style={{ fontSize: '0.8125rem' }}
              />
            </div>

            {/* Model selection */}
            <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20, padding: 24, marginBottom: 20 }}>
              <label className="label" style={{ marginBottom: 12 }}>Модель</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {Object.entries(config.video_models).map(([key, m]) => {
                  const active = modelKey === key;
                  const free = key === 'wan' ? freeWan : freeVeo;
                  const Icon = key === 'veo' ? Crown : Zap;
                  return (
                    <button key={key} onClick={() => setModelKey(key)}
                      style={{
                        flex: 1, padding: '16px 12px', borderRadius: 14,
                        border: `2px solid ${active ? C.primary : C.gray200}`,
                        background: active ? C.primaryLight : C.white,
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Icon size={16} color={active ? C.primaryDark : C.gray500} />
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: active ? C.primaryDark : C.dark }}>{m.label}</span>
                      </div>
                      <p style={{ fontSize: '0.6875rem', color: C.gray500, marginBottom: 6, lineHeight: 1.4 }}>{m.label_full}</p>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: free > 0 ? C.primary : C.gray500 }}>
                        {free > 0 ? `${free} бесплатно` : `${m.credits} кр.`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p style={{ color: C.danger, fontSize: '0.8125rem', marginBottom: 12, textAlign: 'center' }}>{error}</p>}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <p style={{ color: C.gray400, fontSize: '0.8125rem' }}>
                {isFree ? (
                  <><strong style={{ color: C.primary }}>Бесплатно</strong> (пробная генерация)</>
                ) : (
                  <>Стоимость: <strong style={{ color: C.primary }}>{modelCredits} кр.</strong> У вас: <strong>{credits}</strong></>
                )}
              </p>
              <Btn variant="primary" size="lg" disabled={creating || !canAfford} onClick={handleCreate}>
                {creating ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Создаём...
                  </span>
                ) : (
                  <><Sparkles size={18} /> Создать креатив</>
                )}
              </Btn>
            </div>
          </>
        )}

        {/* STEP 3: Generating */}
        {step === 'generating' && (
          <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20 }}>
            <GenerationProgress job={job} type="animate" />
            {job?.status === 'failed' && (
              <div style={{ padding: '0 32px 32px', textAlign: 'center' }}>
                <Btn variant="outline" size="md" onClick={handleReset}>
                  <RefreshCw size={16} /> Попробовать снова
                </Btn>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Result */}
        {step === 'result' && videoUrl && (
          <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 20, padding: 24, textAlign: 'center' }}>
            <video
              controls
              src={videoUrl}
              style={{ width: '100%', maxWidth: 360, borderRadius: 16, marginBottom: 20, background: '#000' }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={videoUrl} download target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <Btn variant="primary" size="md">
                  <Download size={16} /> Скачать MP4
                </Btn>
              </a>
              <Btn variant="outline" size="md" onClick={handleReset}>
                <RefreshCw size={16} /> Создать ещё
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
