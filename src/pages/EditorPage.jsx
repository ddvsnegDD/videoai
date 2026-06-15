// src/pages/EditorPage.jsx
// Sprint C merge: новый 3-колоночный дизайн + реальная бэкенд-логика
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Video, Sparkles, Download, ArrowLeft, AlertTriangle,
  Loader, RefreshCw, ImagePlus,
} from 'lucide-react';
import { C } from '../lib/theme';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useJobPolling } from '../lib/hooks';

const glassPanel = {
  background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(16,185,129,0.12)', borderRadius: 20,
  boxShadow: '0 16px 32px rgba(10,46,31,0.03)', padding: 24,
};

const MOTIONS = [
  { id: 'push_in', name: 'Мягкий наезд', desc: 'Плавное приближение к лицевой части' },
  { id: 'pan', name: 'Панорама', desc: 'Плавное горизонтальное движение вдоль товара' },
  { id: 'orbit', name: 'Облёт', desc: 'Камера плавно облетает вокруг товара' },
  { id: 'pull_back', name: 'Отъезд', desc: 'Плавное удаление от товара' },
  { id: 'tilt', name: 'Подъём', desc: 'Вертикальное движение камеры снизу вверх' },
  { id: 'light_play', name: 'Игра света', desc: 'Минимум движения, акцент на бликах' },
];

const BACK_VIEW = { id: 'back_view', name: 'Вид сзади', desc: 'Анимация отдельного фото задней стороны товара' };

function ModelCard({ on, onClick, name, desc, cost, accent, accentLight, accentDark }) {
  return (
    <button onClick={onClick} style={{ flex: 1, textAlign: 'left', cursor: 'pointer', padding: 18, borderRadius: 14, background: '#fff', position: 'relative', border: on ? `2px solid ${accent}` : '1px solid #E2EAE6', boxShadow: on ? `0 8px 18px ${accent}1f` : 'none' }}>
      {on && <div style={{ position: 'absolute', top: 14, right: 14, width: 9, height: 9, borderRadius: '50%', background: accent }} />}
      <div style={{ fontSize: 15.5, fontWeight: 800, color: C.dark, marginBottom: 6, fontFamily: '"Manrope", sans-serif' }}>{name}</div>
      <p style={{ fontSize: 12, color: '#46594F', lineHeight: 1.4, margin: '0 0 14px' }}>{desc}</p>
      <span style={{ fontSize: 11, fontWeight: 700, background: accentLight, color: accentDark, padding: '4px 8px', borderRadius: 5 }}>{cost}</span>
    </button>
  );
}

export default function EditorPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();

  const [config, setConfig] = useState(null);

  // Source
  const [sourceType, setSourceType] = useState('photo');
  const [imageUrl, setImageUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  // Back-view photo
  const [backImageUrl, setBackImageUrl] = useState(null);
  const [backUploading, setBackUploading] = useState(false);
  const backFileRef = useRef(null);

  // Text-to-image generate flow
  const [productType, setProductType] = useState('');
  const [details, setDetails] = useState('');
  const [style, setStyle] = useState('');
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageJobId, setImageJobId] = useState(null);
  const { job: imageJob } = useJobPolling(imageJobId);
  const [imageSource, setImageSource] = useState(null); // 'upload' | 'generated'
  const [showImagePreview, setShowImagePreview] = useState(false);

  // Animation
  const [motion, setMotion] = useState('push_in');
  const [motionManual, setMotionManual] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [model, setModel] = useState('wan');
  const [targetDuration, setTargetDuration] = useState(5);
  const [projectId, setProjectId] = useState(null);
  const [continueCount, setContinueCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState(null);
  const { job } = useJobPolling(jobId);

  // Regen confirmation
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  // Load config
  useEffect(() => {
    api.get('/config').then(setConfig).catch(() => {});
  }, []);

  // Auto-rotate motion preset based on local continue count (per product).
  // Resets to 0 on new photo/product, increments on each "Continue (another angle)".
  useEffect(() => {
    if (motionManual) return;
    setMotion(MOTIONS[continueCount % MOTIONS.length].id);
  }, [continueCount, motionManual]);

  // Refresh credits on job completion
  useEffect(() => {
    if (job?.status === 'done' || job?.status === 'failed') refresh();
  }, [job?.status]);

  // When image job completes
  useEffect(() => {
    if (imageJob?.status === 'done' && imageJob?.output?.image_url) {
      setImageUrl(imageJob.output.image_url);
      setImageSource('generated');
      setContinueCount(0);
      setShowImagePreview(true);
      refresh();
    }
    if (imageJob?.status === 'failed') refresh();
  }, [imageJob?.status]);

  // Credits & free trials
  const credits = user?.credits ?? 0;
  const freeWan = user?.free_wan ?? 0;
  const freeVeo = user?.free_veo ?? 0;
  const freeImage = user?.free_image ?? 0;
  const modelCredits = model === 'wan' ? targetDuration * 8 : model === 'cosmos' ? (config?.video_models?.cosmos?.credits ?? 75) : (config?.video_models?.veo?.credits ?? 90);
  const creditsImage = config?.credits_image ?? 13;
  const isFree = (model === 'wan' && targetDuration === 5 && freeWan > 0) || (model === 'veo' && freeVeo > 0);
  const isFreeImage = freeImage > 0;
  const canAfford = isFree || credits >= modelCredits;
  const needsBack = motion === 'back_view';
  const canAffordImage = isFreeImage || credits >= creditsImage;

  // Derive phase for the monitor
  let phase; // 'idle' | 'uploading' | 'generating_image' | 'confirm_image' | 'ready' | 'running' | 'done' | 'failed'
  if (jobId) {
    if (job?.status === 'done') phase = 'done';
    else if (job?.status === 'failed') phase = 'failed';
    else phase = 'running';
  } else if (imageJobId && !showImagePreview) {
    if (imageJob?.status === 'done') phase = 'confirm_image';
    else if (imageJob?.status === 'failed') phase = 'failed_image';
    else phase = 'generating_image';
  } else if (showImagePreview) {
    phase = 'confirm_image';
  } else if (imageUrl) {
    phase = 'ready';
  } else if (uploading) {
    phase = 'uploading';
  } else {
    phase = 'idle';
  }

  const videoUrl = job?.output?.video_url;
  const previewImageUrl = (motion === 'back_view' && backImageUrl) ? backImageUrl : imageUrl;

  // ── Handlers ──

  async function uploadPhoto(file) {
    if (file.size > 10 * 1024 * 1024) { setError('Максимум 10 МБ'); return null; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Только JPG, PNG, WEBP'); return null; }
    setError('');
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' });
    if (!res.ok) throw new Error('Upload failed');
    return (await res.json()).url;
  }

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPhoto(file);
      if (!url) return;
      setImageUrl(url);
      setImageSource('upload');
      setContinueCount(0);
    } catch {
      setError('Ошибка загрузки. Попробуйте ещё раз.');
    } finally {
      setUploading(false);
    }
  }

  async function handleBackFile(file) {
    if (!file) return;
    setBackUploading(true);
    try {
      const url = await uploadPhoto(file);
      if (!url) return;
      setBackImageUrl(url);
    } catch {
      setError('Ошибка загрузки. Попробуйте ещё раз.');
    } finally {
      setBackUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }

  async function handleGenerateImage() {
    if (!productType.trim() || generatingPrompt || !canAffordImage) return;
    setGeneratingPrompt(true);
    setError('');

    try {
      const promptRes = await api.post('/build-image-prompt', {
        productType: productType.trim(),
        details: details.trim() || undefined,
        style: style.trim() || undefined,
      });
      setImagePrompt(promptRes.prompt);

      const proj = await api.post('/projects', {
        title: `Креатив ${new Date().toLocaleDateString('ru-RU')}`,
        brief: {
          source: 'generated',
          product_type: productType.trim(),
          details: details.trim(),
          style: style.trim(),
          image_prompt: promptRes.prompt,
        },
      });
      setProjectId(proj.project.id);

      const jobRes = await api.post('/jobs', {
        projectId: proj.project.id,
        type: 'image',
        input: { prompt: promptRes.prompt },
      });
      setImageJobId(jobRes.jobId);
      refresh();
    } catch (err) {
      if (err.data?.error === 'INSUFFICIENT_CREDITS') {
        setError(`Недостаточно кредитов. Нужно ${creditsImage}.`);
      } else if (err.data?.error === 'TOO_MANY_ACTIVE_JOBS') {
        setError('Уже есть активная генерация. Дождитесь завершения.');
      } else if (err.data?.error === 'llm_unavailable') {
        setError('GigaChat временно недоступен. Попробуйте позже.');
      } else {
        setError('Ошибка генерации картинки');
      }
    } finally {
      setGeneratingPrompt(false);
    }
  }

  async function handleRegenImage() {
    if (!projectId || !imagePrompt || !canAffordImage) return;
    setShowRegenConfirm(false);
    setShowImagePreview(false);
    setError('');
    setImageUrl(null);
    setImageSource(null);
    setContinueCount(0);

    try {
      const jobRes = await api.post('/jobs', {
        projectId,
        type: 'image',
        input: { prompt: imagePrompt },
      });
      setImageJobId(jobRes.jobId);
      refresh();
    } catch (err) {
      if (err.data?.error === 'INSUFFICIENT_CREDITS') {
        setError(`Недостаточно кредитов. Нужно ${creditsImage}.`);
      } else if (err.data?.error === 'TOO_MANY_ACTIVE_JOBS') {
        setError('Уже есть активная генерация. Дождитесь завершения.');
      } else {
        setError('Ошибка перегенерации');
      }
    }
  }

  function handleConfirmImage() {
    setShowImagePreview(false);
    setImageJobId(null);
  }

  async function handleCreate() {
    if (!imageUrl || creating) return;
    setCreating(true);
    setError('');

    try {
      let pid = projectId;

      if (!pid) {
        const motionName = MOTIONS.find(m => m.id === motion)?.name || '';
        const proj = await api.post('/projects', {
          title: `Креатив ${new Date().toLocaleDateString('ru-RU')}${motionName ? ` · ${motionName}` : ''}`,
          brief: { source: 'upload', image_url: imageUrl, model, motion },
        });
        pid = proj.project.id;
        setProjectId(pid);
      }

      const res = await api.post('/jobs', {
        projectId: pid,
        type: 'animate',
        input: {
          imageUrl: needsBack ? backImageUrl : imageUrl,
          modelKey: model,
          targetDuration: model === 'wan' ? targetDuration : undefined,
          motionPrompt: customPrompt.trim() || undefined,
          motionKey: motion,
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

  function handleContinue() {
    setJobId(null);
    setProjectId(null);
    setContinueCount(c => c + 1);
    setError('');
    setCustomPrompt('');
    setMotionManual(false);
    setShowRegenConfirm(false);
    setShowImagePreview(false);
    // imageUrl, sourceType, model, targetDuration — сохраняем
    // productType, details, style — сохраняем (описание того же товара)
    refresh();
  }

  function handleReset() {
    setJobId(null);
    setImageJobId(null);
    setImageUrl(null);
    setImageSource(null);
    setBackImageUrl(null);
    setProjectId(null);
    setContinueCount(0);
    setImagePrompt('');
    setSourceType('photo');
    setError('');
    setCustomPrompt('');
    setMotionManual(false);
    setProductType('');
    setDetails('');
    setStyle('');
    setShowRegenConfirm(false);
    setShowImagePreview(false);
    refresh();
  }

  const stepNum = (n) => <span style={{ color: C.primary, fontFamily: '"Manrope", sans-serif' }}>{n}</span>;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px 56px' }}>
      <style>{`@keyframes va-spin { to { transform: rotate(360deg); } } @media (max-width: 920px){ .va-editor-grid{ grid-template-columns:1fr !important; } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 26 }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#46594F', fontSize: 14, fontWeight: 600 }}><ArrowLeft size={16} /> К проектам</button>
        <div style={{ width: 1, height: 16, background: '#E2E8F0' }} />
        <h1 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 23, fontWeight: 800, color: C.dark, margin: 0, letterSpacing: '-0.02em' }}>
          {phase === 'done' ? 'Креатив готов' : 'Новый видеокреатив'}
        </h1>
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', marginBottom: 20, color: '#991B1B', fontSize: 14, fontWeight: 500 }}>
          {error}
        </div>
      )}

      <div className="va-editor-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 432px', gap: 28, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Шаг 1: Исходный контент */}
          <div style={glassPanel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, fontFamily: '"Manrope", sans-serif', color: C.dark }}>{stepNum('01.')} Исходный контент</h2>
              <div style={{ display: 'flex', background: '#E2E8F0', padding: 3, borderRadius: 9 }}>
                {[['photo', 'Загрузить фото'], ['text', 'Описать словами']].map(([id, l]) => (
                  <button key={id} onClick={() => { if (!imageUrl) setSourceType(id); }} style={{ border: 'none', cursor: imageUrl ? 'default' : 'pointer', padding: '7px 13px', borderRadius: 7, fontSize: 13, fontWeight: 600, background: sourceType === id ? '#fff' : 'transparent', color: sourceType === id ? C.dark : '#64748B' }}>{l}</button>
                ))}
              </div>
            </div>

            {/* Image uploaded preview */}
            {imageUrl && !showImagePreview && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#F8FBF9', borderRadius: 12, padding: 14 }}>
                <img src={imageUrl} alt="" style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover' }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.dark, marginBottom: 4 }}>
                    {imageSource === 'generated' ? 'Картинка сгенерирована' : 'Фото загружено'}
                  </p>
                  <button onClick={handleReset} style={{ background: 'none', border: 'none', color: '#6B7F74', fontSize: 12, cursor: 'pointer', padding: 0 }}>Заменить</button>
                </div>
              </div>
            )}

            {!imageUrl && sourceType === 'photo' && (
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${C.primary}`, borderRadius: 12, padding: '38px 20px', textAlign: 'center', background: '#F8FBF9', cursor: 'pointer' }}
              >
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => handleFile(e.target.files?.[0])} />
                {uploading ? (
                  <Loader size={30} color={C.primary} style={{ animation: 'va-spin 1s linear infinite', marginBottom: 10 }} />
                ) : (
                  <Upload size={30} color={C.primary} style={{ marginBottom: 10 }} />
                )}
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, color: C.dark }}>
                  {uploading ? 'Загрузка...' : 'Перетащите фото товара сюда'}
                </div>
                <div style={{ fontSize: 12.5, color: '#6B7F74' }}>JPG, PNG, WEBP · до 10 МБ · рекомендуемые пропорции 3:4</div>
              </div>
            )}

            {!imageUrl && sourceType === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  placeholder="Тип товара: крем для лица, кроссовки Nike, свеча..."
                  value={productType}
                  onChange={e => setProductType(e.target.value)}
                  style={{ width: '100%', borderRadius: 10, background: '#F8FBF9', border: '1px solid #E2EAE6', padding: 14, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 14, color: C.dark }}
                />
                <input
                  placeholder="Детали: цвет, форма, текст на упаковке..."
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  style={{ width: '100%', borderRadius: 10, background: '#F8FBF9', border: '1px solid #E2EAE6', padding: 14, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 14, color: C.dark }}
                />
                <input
                  placeholder="Стиль: премиум, минимализм, яркий, тёмный фон..."
                  value={style}
                  onChange={e => setStyle(e.target.value)}
                  style={{ width: '100%', borderRadius: 10, background: '#F8FBF9', border: '1px solid #E2EAE6', padding: 14, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 14, color: C.dark }}
                />
                <div style={{ display: 'flex', gap: 10, background: '#FFF4E8', border: '1px solid #FBD9AE', padding: 12, borderRadius: 10, fontSize: 12.5, color: '#8A5A18', lineHeight: 1.45 }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div><b>Пометка:</b> нейросеть создаст ИИ-иллюстрацию <b>по описанию</b>, а не точную копию товара. {isFreeImage ? <strong style={{ color: C.primary }}>Первая картинка бесплатно.</strong> : `Стоимость: ${creditsImage} кредитов.`}</div>
                </div>
                <button
                  onClick={handleGenerateImage}
                  disabled={!productType.trim() || generatingPrompt || !canAffordImage}
                  style={{
                    width: '100%', border: 'none', cursor: (!productType.trim() || generatingPrompt || !canAffordImage) ? 'default' : 'pointer',
                    background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: '#fff', padding: 14, borderRadius: 11,
                    fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: (!productType.trim() || generatingPrompt || !canAffordImage) ? 0.5 : 1,
                  }}
                >
                  {generatingPrompt ? (
                    <><Loader size={16} style={{ animation: 'va-spin 1s linear infinite' }} /> Генерирую картинку...</>
                  ) : (
                    <><ImagePlus size={16} /> {isFreeImage ? 'Сгенерировать бесплатно' : `Сгенерировать (${creditsImage} кр.)`}</>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Шаг 2: Стиль движения камеры */}
          <div style={{ ...glassPanel, opacity: imageUrl && !showImagePreview ? 1 : 0.5, pointerEvents: imageUrl && !showImagePreview ? 'auto' : 'none' }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 14px', fontFamily: '"Manrope", sans-serif', color: C.dark }}>{stepNum('02.')} Стиль движения камеры</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[...MOTIONS, BACK_VIEW].map(m => {
                const on = motion === m.id && !customPrompt.trim();
                return (
                  <button key={m.id} onClick={() => { setMotion(m.id); setMotionManual(true); setCustomPrompt(''); }} style={{ textAlign: 'left', cursor: 'pointer', padding: 14, borderRadius: 12, background: '#fff', border: on ? `2px solid ${C.primary}` : '1px solid #E2EAE6', boxShadow: on ? '0 8px 16px rgba(16,185,129,0.1)' : 'none' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: on ? C.primaryLight : '#F1F5F9', display: 'grid', placeItems: 'center', color: on ? C.primary : '#64748B', marginBottom: 10 }}><Video size={16} /></div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: C.dark, marginBottom: 2 }}>{m.name}</div>
                    <div style={{ fontSize: 11.5, color: '#6B7F74', lineHeight: 1.3 }}>{m.desc}</div>
                  </button>
                );
              })}
            </div>
            {motion === 'back_view' && (
              <div style={{ marginTop: 12, padding: 16, background: '#FFF8F0', border: '1px solid #FBD9AE', borderRadius: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 10 }}>Загрузите фото товара сзади</div>
                {backImageUrl ? (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <img src={backImageUrl} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover' }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.dark, margin: '0 0 4px' }}>Фото загружено</p>
                      <button onClick={() => setBackImageUrl(null)} style={{ background: 'none', border: 'none', color: '#6B7F74', fontSize: 12, cursor: 'pointer', padding: 0 }}>Заменить</button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => backFileRef.current?.click()}
                    style={{ border: '2px dashed #E8A54B', borderRadius: 10, padding: '20px 16px', textAlign: 'center', background: '#FFFDF8', cursor: 'pointer' }}
                  >
                    <input ref={backFileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => handleBackFile(e.target.files?.[0])} />
                    {backUploading ? (
                      <Loader size={22} color="#E8A54B" style={{ animation: 'va-spin 1s linear infinite', marginBottom: 6 }} />
                    ) : (
                      <Upload size={22} color="#E8A54B" style={{ marginBottom: 6 }} />
                    )}
                    <div style={{ fontWeight: 600, fontSize: 13, color: C.dark }}>
                      {backUploading ? 'Загрузка...' : 'Перетащите или нажмите'}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#6B7F74' }}>JPG, PNG, WEBP · до 10 МБ</div>
                  </div>
                )}
              </div>
            )}
            <input
              placeholder="Или свой вариант (англ. промпт)"
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              style={{ width: '100%', marginTop: 12, borderRadius: 10, background: '#F8FBF9', border: '1px solid #E2EAE6', padding: 12, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 13, color: C.dark }}
            />
          </div>

          {/* Шаг 3: Режим рендеринга */}
          <div style={{ ...glassPanel, opacity: imageUrl && !showImagePreview ? 1 : 0.5, pointerEvents: imageUrl && !showImagePreview ? 'auto' : 'none' }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 14px', fontFamily: '"Manrope", sans-serif', color: C.dark }}>{stepNum('03.')} Режим рендеринга</h2>
            <div style={{ display: 'flex', gap: 14 }}>
              <ModelCard on={model === 'wan'} onClick={() => setModel('wan')}
                name="Эконом · Kling 2.5"
                desc={`Клип ${targetDuration} сек. Жёсткое удержание шрифта и геометрии товара. Формат 9:16.`}
                cost={targetDuration === 5 && freeWan > 0 ? `${freeWan} бесплатно` : `${targetDuration * 8} кредитов`}
                accent={C.primary} accentLight={C.primaryLight} accentDark={C.primaryDark} />
              <ModelCard on={model === 'cosmos'} onClick={() => setModel('cosmos')}
                name="Стандарт · Cosmos"
                desc="Клип 10 сек. Детальное следование промпту. Формат 9:16."
                cost={`${config?.video_models?.cosmos?.credits ?? 75} кредитов`}
                accent="#F59E0B" accentLight="#FFFBEB" accentDark="#B45309" />
              <ModelCard on={model === 'veo'} onClick={() => setModel('veo')}
                name="Премиум · Veo 3.1"
                desc="Клип 8 секунд. Кинематографичный свет, боке и глубина резкости. Формат 9:16."
                cost={freeVeo > 0 ? `${freeVeo} бесплатно` : `${config?.video_models?.veo?.credits ?? 90} кредитов`}
                accent="#6366F1" accentLight="#EEF2FF" accentDark="#4F46E5" />
            </div>

            {/* Duration selector for Kling */}
            {model === 'wan' && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Длительность клипа</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[5, 10].map(d => {
                    const on = targetDuration === d;
                    const dCredits = d * 8;
                    const dFree = d === 5 && freeWan > 0;
                    return (
                      <button key={d} onClick={() => setTargetDuration(d)} style={{
                        flex: 1, border: on ? `2px solid ${C.primary}` : '1px solid #E2EAE6',
                        borderRadius: 10, padding: '10px 4px', cursor: 'pointer',
                        background: on ? C.primaryLight : '#fff', textAlign: 'center',
                        transition: 'all 0.15s ease',
                      }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: C.dark }}>{d}с</div>
                        <div style={{ fontSize: 11, color: dFree ? C.primary : '#6B7F74', fontWeight: 600, marginTop: 2 }}>
                          {dFree ? 'бесплатно' : `${dCredits} кр.`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {model === 'veo' && imageUrl && (
              <div style={{ display: 'flex', gap: 10, background: '#FFF8F0', border: '1px solid #FBD9AE', padding: 12, borderRadius: 10, fontSize: 12.5, color: '#8A5A18', lineHeight: 1.45, marginTop: 14 }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>Veo иногда отклоняет фото с людьми. Если на снимке есть человек — надёжнее выбрать Kling. Если Veo не справится, кредиты вернутся автоматически.</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: 13, color: '#6B7F74' }}>
              <span>{isFree ? <strong style={{ color: C.primary }}>Бесплатно (пробная генерация)</strong> : `Стоимость: ${modelCredits} кр. · Баланс: ${credits}`}</span>
            </div>

            <button
              onClick={handleCreate}
              disabled={!imageUrl || creating || !canAfford || showImagePreview || (needsBack && !backImageUrl)}
              style={{
                width: '100%', border: 'none',
                cursor: (!imageUrl || creating || !canAfford || showImagePreview || (needsBack && !backImageUrl)) ? 'default' : 'pointer',
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: '#fff',
                padding: 16, borderRadius: 11, fontSize: 16, fontWeight: 700, marginTop: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 10px 24px rgba(16,185,129,0.26)',
                opacity: (!imageUrl || creating || !canAfford || showImagePreview || (needsBack && !backImageUrl)) ? 0.5 : 1,
              }}
            >
              {creating ? (
                <><Loader size={18} style={{ animation: 'va-spin 1s linear infinite' }} /> Создаём...</>
              ) : (
                <><Sparkles size={18} /> {isFree ? 'Сгенерировать бесплатно' : `Сгенерировать за ${modelCredits} кр.`}</>
              )}
            </button>
          </div>
        </div>

        {/* ═══ Монитор (правая колонка) ═══ */}
        <div style={{ position: 'sticky', top: 86 }}>
          <div style={{ ...glassPanel, minHeight: 540, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>

            {/* IDLE */}
            {phase === 'idle' && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F1F5F9', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: '#64748B' }}><Video size={28} /></div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: C.dark }}>Монитор видеоплеера</h3>
                <p style={{ fontSize: 13.5, color: '#6B7F74', margin: 0, lineHeight: 1.45, maxWidth: 260 }}>Настройте параметры слева и запустите генерацию.</p>
              </div>
            )}

            {/* UPLOADING */}
            {phase === 'uploading' && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Loader size={30} color={C.primary} style={{ animation: 'va-spin 1s linear infinite', marginBottom: 12 }} />
                <div style={{ fontWeight: 700, fontSize: 15, color: C.dark }}>Загрузка фото...</div>
              </div>
            )}

            {/* IMAGE READY */}
            {phase === 'ready' && imageUrl && (
              <div style={{ textAlign: 'center', padding: 20, width: '100%' }}>
                <img src={previewImageUrl} alt="Исходник" style={{ width: '100%', maxWidth: 280, borderRadius: 14, marginBottom: 16, background: '#F1F5F9' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px', color: C.dark }}>
                  {needsBack && backImageUrl ? 'Фото задней стороны' : imageSource === 'generated' ? 'Картинка готова' : 'Фото загружено'}
                </h3>
                <p style={{ fontSize: 13, color: '#6B7F74', margin: 0 }}>Выберите движение и модель, затем запустите генерацию.</p>
              </div>
            )}

            {/* GENERATING IMAGE */}
            {phase === 'generating_image' && (
              <div style={{ width: '100%', padding: 20, boxSizing: 'border-box' }}>
                <div style={{ textAlign: 'center', marginBottom: 22 }}>
                  <Loader size={30} color="#6366F1" style={{ animation: 'va-spin 1s linear infinite', marginBottom: 12 }} />
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.dark }}>Генерирую картинку...</div>
                  <div style={{ fontSize: 12.5, color: '#6B7F74', marginTop: 4 }}>Обычно 15–30 секунд</div>
                </div>
                {imageJob && (
                  <div style={{ width: '100%', height: 6, background: '#E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(imageJob.progress || 0, imageJob.status === 'running' ? 5 : 0)}%`, height: '100%', background: 'linear-gradient(90deg, #6366F1, #4F46E5)', borderRadius: 10, transition: 'width .35s ease' }} />
                  </div>
                )}
              </div>
            )}

            {/* CONFIRM IMAGE */}
            {phase === 'confirm_image' && (
              <div style={{ width: '100%', padding: 20, boxSizing: 'border-box', textAlign: 'center' }}>
                {imageJob?.status === 'failed' ? (
                  <>
                    <p style={{ color: C.danger, fontWeight: 600, marginBottom: 8 }}>Ошибка генерации картинки</p>
                    <p style={{ color: '#6B7F74', fontSize: 13, marginBottom: 16 }}>{imageJob.error || 'Неизвестная ошибка'}</p>
                    <button onClick={handleReset} style={{ background: '#F1F5F9', border: 'none', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.dark, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <RefreshCw size={14} /> Начать заново
                    </button>
                  </>
                ) : (
                  <>
                    <img src={imageUrl} alt="Сгенерированная картинка" style={{ width: '100%', maxWidth: 280, borderRadius: 14, marginBottom: 16, background: '#F1F5F9' }} />
                    {showRegenConfirm ? (
                      <div style={{ background: '#F8FBF9', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                        <p style={{ fontSize: 14, color: C.dark, marginBottom: 12 }}>
                          {isFreeImage
                            ? <><strong style={{ color: C.primary }}>Бесплатно.</strong> Перегенерировать?</>
                            : <>Будет списано <strong style={{ color: C.primary }}>{creditsImage} кр.</strong> Продолжить?</>
                          }
                        </p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button disabled={!canAffordImage} onClick={handleRegenImage} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600 }}>Да, перегенерировать</button>
                          <button onClick={() => setShowRegenConfirm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2EAE6', cursor: 'pointer', background: '#fff', color: C.dark, fontSize: 13, fontWeight: 600 }}>Отмена</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={handleConfirmImage} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 6px 16px rgba(16,185,129,0.25)' }}>
                          <Sparkles size={14} /> Оживить
                        </button>
                        <button onClick={() => setShowRegenConfirm(true)} style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${C.primary}`, cursor: 'pointer', background: '#fff', color: C.primaryDark, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <RefreshCw size={14} /> {isFreeImage ? 'Перегенерировать (бесплатно)' : `Перегенерировать (${creditsImage} кр.)`}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* FAILED IMAGE */}
            {phase === 'failed_image' && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <p style={{ color: C.danger, fontWeight: 600, marginBottom: 8 }}>Ошибка генерации картинки</p>
                <p style={{ color: '#6B7F74', fontSize: 13, marginBottom: 16 }}>{imageJob?.error || 'Неизвестная ошибка'}</p>
                <button onClick={handleReset} style={{ background: '#F1F5F9', border: 'none', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.dark, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <RefreshCw size={14} /> Начать заново
                </button>
              </div>
            )}

            {/* RUNNING (video) */}
            {phase === 'running' && (() => {
              const progress = job?.progress || 0;
              const statusText = job?.status === 'pending' ? 'В очереди...' : 'Оживляю ваш товар...';
              return (
                <div style={{ width: '100%', padding: 20, boxSizing: 'border-box' }}>
                  <div style={{ textAlign: 'center', marginBottom: 22 }}>
                    <Loader size={30} color={C.primary} style={{ animation: 'va-spin 1s linear infinite', marginBottom: 12 }} />
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.dark }}>{statusText}</div>
                    <div style={{ fontSize: 12.5, color: '#6B7F74', marginTop: 4 }}>Обычно занимает 1–3 минуты</div>
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(progress, 5)}%`, height: '100%', background: `linear-gradient(90deg, ${C.primary}, ${C.primaryDark})`, borderRadius: 10, transition: 'width .35s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7F74', marginTop: 8 }}>
                    <span>Статус: {job?.status === 'pending' ? 'в очереди' : 'рендеринг'}...</span>
                    <span>{progress}%</span>
                  </div>
                </div>
              );
            })()}

            {/* FAILED (video) */}
            {phase === 'failed' && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <p style={{ color: C.danger, fontWeight: 600, marginBottom: 8 }}>Ошибка генерации видео</p>
                <p style={{ color: '#6B7F74', fontSize: 13, marginBottom: 16 }}>{job?.error || 'Неизвестная ошибка'}</p>
                <button onClick={handleReset} style={{ background: '#F1F5F9', border: 'none', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.dark, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <RefreshCw size={14} /> Попробовать снова
                </button>
              </div>
            )}

            {/* DONE */}
            {phase === 'done' && videoUrl && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '9 / 16', maxHeight: 400, borderRadius: 12, overflow: 'hidden', background: '#000', margin: '0 auto 16px' }}>
                  <video src={videoUrl} controls autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.62)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{model === 'veo' ? 'Veo 3.1 · 8s' : model === 'cosmos' ? 'Cosmos · 10s' : `Kling 2.5 · ${targetDuration}s`}</div>
                </div>
                <a href={videoUrl} download target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <button style={{ width: '100%', border: 'none', background: C.dark, color: '#fff', padding: 14, borderRadius: 11, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Download size={16} /> Скачать готовый креатив (MP4)</button>
                </a>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button onClick={handleContinue} style={{ flex: 1, border: `1.5px solid ${C.primary}`, background: C.primaryLight, color: C.primaryDark, padding: '11px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Продолжить (другой ракурс)</button>
                  <button onClick={handleReset} style={{ border: `1px solid ${C.gray200}`, background: '#fff', color: '#6B7F74', padding: '11px 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Начать сначала</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
