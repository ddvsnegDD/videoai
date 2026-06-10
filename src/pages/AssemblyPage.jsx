import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Video, Film, Loader, CheckCircle, XCircle, Download,
  GripVertical, X, Music, Upload,
} from 'lucide-react';
import { C } from '../lib/theme';
import { api } from '../lib/api';

const glassPanel = {
  background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(16,185,129,0.12)', borderRadius: 20,
  boxShadow: '0 16px 32px rgba(10,46,31,0.03)', padding: 24,
};

const POLL_INTERVAL = 3000;
const MAX_POLLS = 100;

function ClipThumb({ clip, selected, onToggle }) {
  const isVeo = clip.model === 'veo';
  return (
    <div
      onClick={onToggle}
      style={{
        position: 'relative', borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        border: selected ? `2px solid ${C.primary}` : '2px solid transparent',
        boxShadow: selected ? `0 0 0 2px ${C.primaryLight}` : 'none',
        opacity: selected ? 1 : 0.7, transition: 'all 0.15s',
      }}
    >
      <div style={{ aspectRatio: '4/3', background: '#0a1f16', position: 'relative' }}>
        {clip.image_url ? (
          <img src={clip.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#fff' }}>
            <Film size={20} />
          </div>
        )}
        <div style={{ position: 'absolute', top: 6, left: 6, background: isVeo ? 'rgba(99,102,241,0.9)' : 'rgba(10,46,31,0.8)', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
          {isVeo ? 'Veo' : 'Kling'}
        </div>
        {selected && (
          <div style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: C.primary, display: 'grid', placeItems: 'center' }}>
            <CheckCircle size={14} color="#fff" />
          </div>
        )}
      </div>
      <div style={{ padding: '6px 8px', background: '#fff', fontSize: 11, fontWeight: 600, color: C.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {clip.title}
      </div>
    </div>
  );
}

function OrderItem({ clip, index, onRemove, onDragStart, onDragOver, onDrop }) {
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, index)}
      onDragOver={e => { e.preventDefault(); onDragOver(e, index); }}
      onDrop={e => onDrop(e, index)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
        background: '#fff', borderRadius: 10, border: '1px solid #E2EAE6',
        cursor: 'grab', fontSize: 13, fontWeight: 600, color: C.dark,
      }}
    >
      <GripVertical size={14} color={C.gray400} style={{ flexShrink: 0 }} />
      <span style={{ width: 22, height: 22, borderRadius: 6, background: C.primaryLight, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, color: C.primaryDark, flexShrink: 0 }}>{index + 1}</span>
      <div style={{ width: 40, height: 30, borderRadius: 4, overflow: 'hidden', background: '#0a1f16', flexShrink: 0 }}>
        {clip.image_url ? (
          <img src={clip.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
            <Film size={12} color="#fff" />
          </div>
        )}
      </div>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clip.title}</span>
      <button onClick={() => onRemove(clip.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.gray400, padding: 0, display: 'grid', flexShrink: 0 }}>
        <X size={14} />
      </button>
    </div>
  );
}

export default function AssemblyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const existingId = searchParams.get('id');

  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [canvas, setCanvas] = useState('9x16');
  const [audioFile, setAudioFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Polling state
  const [assemblyId, setAssemblyId] = useState(existingId ? Number(existingId) : null);
  const [assembly, setAssembly] = useState(null);
  const pollRef = useRef(0);
  const timerRef = useRef(null);

  const dragItem = useRef(null);
  const dragOver = useRef(null);
  const audioInputRef = useRef(null);

  useEffect(() => {
    api.get('/clips').then(d => setClips(d.clips || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Polling for assembly status
  useEffect(() => {
    if (!assemblyId) return;
    let cancelled = false;
    pollRef.current = 0;

    async function poll() {
      if (cancelled) return;
      pollRef.current++;
      try {
        const data = await api.get(`/assemblies/${assemblyId}`);
        if (cancelled) return;
        setAssembly(data.assembly);
        if (data.assembly.status === 'done' || data.assembly.status === 'failed') return;
        if (pollRef.current >= MAX_POLLS) return;
        timerRef.current = setTimeout(poll, POLL_INTERVAL);
      } catch {
        if (cancelled || pollRef.current >= MAX_POLLS) return;
        timerRef.current = setTimeout(poll, POLL_INTERVAL);
      }
    }
    poll();
    return () => { cancelled = true; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [assemblyId]);

  function toggleClip(clip) {
    setSelected(prev => {
      const exists = prev.find(c => c.id === clip.id);
      if (exists) return prev.filter(c => c.id !== clip.id);
      if (prev.length >= 10) return prev;
      return [...prev, clip];
    });
  }

  function removeFromOrder(clipId) {
    setSelected(prev => prev.filter(c => c.id !== clipId));
  }

  function handleDragStart(e, idx) { dragItem.current = idx; }
  function handleDragOver(e, idx) { dragOver.current = idx; }
  function handleDrop() {
    const from = dragItem.current;
    const to = dragOver.current;
    if (from === null || to === null || from === to) return;
    setSelected(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
    dragItem.current = null;
    dragOver.current = null;
  }

  async function handleSubmit() {
    if (selected.length === 0) return;
    setSubmitting(true);
    setError('');

    try {
      // Use FormData to send audio as binary (avoids stack overflow on large files)
      const fd = new FormData();
      fd.append('clip_ids', JSON.stringify(selected.map(c => c.id)));
      fd.append('canvas', canvas);
      if (audioFile) {
        if (audioFile.size > 20 * 1024 * 1024) {
          setError('Аудиофайл слишком большой (максимум 20 МБ)');
          setSubmitting(false);
          return;
        }
        fd.append('audio', audioFile);
      }

      const res = await fetch('/api/assemblies', {
        method: 'POST',
        credentials: 'include',
        body: fd, // browser sets Content-Type: multipart/form-data automatically
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw { data, message: data.message || data.error || `HTTP ${res.status}` };
      }

      // If audio was attached but server says no audio was received — warn user
      if (audioFile && data.assembly && !data.audioReceived) {
        console.warn('Audio file was attached but server did not acknowledge it');
      }

      setAssemblyId(data.assembly.id);
      setAssembly(data.assembly);
    } catch (err) {
      setError(err.data?.message || err.message || 'Ошибка создания сборки');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setAssemblyId(null);
    setAssembly(null);
    setSelected([]);
    setAudioFile(null);
    setError('');
    pollRef.current = 0;
  }

  // ── Render: Assembly progress/result ──
  if (assemblyId && assembly) {
    const s = assembly.status;

    if (s === 'done') {
      return (
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircle size={40} color={C.primary} />
          </div>
          <h1 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 24, fontWeight: 800, color: C.dark, marginBottom: 12 }}>Ролик собран!</h1>
          <div style={{ ...glassPanel, marginBottom: 24, padding: 0, overflow: 'hidden', borderRadius: 16 }}>
            <video src={assembly.output_url} controls style={{ width: '100%', display: 'block' }} />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={assembly.output_url} download target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: C.primary, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
                <Download size={16} /> Скачать MP4
              </button>
            </a>
            <button onClick={reset} style={{ padding: '12px 28px', borderRadius: 12, border: `1px solid ${C.gray200}`, background: '#fff', color: C.gray600, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
              Собрать ещё
            </button>
          </div>
        </div>
      );
    }

    if (s === 'failed') {
      return (
        <div style={{ maxWidth: 500, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <XCircle size={40} color={C.danger} />
          </div>
          <h1 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 22, fontWeight: 700, color: C.dark, marginBottom: 12 }}>Ошибка сборки</h1>
          <p style={{ color: C.gray500, fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>{assembly.error || 'Неизвестная ошибка'}</p>
          <button onClick={reset} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: C.primary, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Попробовать снова
          </button>
        </div>
      );
    }

    // queued / processing
    return (
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <style>{`@keyframes va-spin { to { transform: rotate(360deg); } }`}</style>
        <Loader size={48} color={C.primary} style={{ animation: 'va-spin 1.2s linear infinite', marginBottom: 24 }} />
        <h1 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 22, fontWeight: 700, color: C.dark, marginBottom: 12 }}>
          {s === 'queued' ? 'В очереди...' : 'Собираем ролик...'}
        </h1>
        <p style={{ color: C.gray500, fontSize: 14, lineHeight: 1.5 }}>
          Нормализация клипов, склейка и наложение аудио. Обычно это занимает 1–3 минуты.
        </p>
      </div>
    );
  }

  // ── Render: Builder ──
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '36px 24px 64px' }}>
      <style>{`@keyframes va-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ ...glassPanel, marginBottom: 28 }}>
        <h1 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 24, fontWeight: 800, margin: '0 0 4px', color: C.dark, letterSpacing: '-0.02em' }}>Склеить ролик</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: '#46594F' }}>Выберите клипы, задайте порядок, добавьте музыку — бесплатно</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
        {/* Left: clip picker */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 16 }}>Выберите клипы <span style={{ fontWeight: 400, color: C.gray400, fontSize: 13 }}>({selected.length}/10)</span></h2>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader size={28} color={C.primary} style={{ animation: 'va-spin 1s linear infinite' }} />
            </div>
          ) : clips.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {clips.map(c => (
                <ClipThumb key={c.id} clip={c} selected={!!selected.find(s => s.id === c.id)} onToggle={() => toggleClip(c)} />
              ))}
            </div>
          ) : (
            <div style={{ ...glassPanel, textAlign: 'center', padding: '40px 24px' }}>
              <Film size={28} color={C.gray400} />
              <p style={{ color: C.gray500, fontSize: 14, marginTop: 12 }}>Нет готовых клипов. Сначала создайте видео в редакторе.</p>
            </div>
          )}
        </div>

        {/* Right: order + settings */}
        <div style={{ position: 'sticky', top: 90 }}>
          <div style={{ ...glassPanel, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 12 }}>Порядок склейки</h3>
            {selected.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selected.map((c, i) => (
                  <OrderItem key={c.id} clip={c} index={i} onRemove={removeFromOrder}
                    onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop} />
                ))}
              </div>
            ) : (
              <p style={{ color: C.gray400, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Кликните на клипы слева</p>
            )}
          </div>

          {/* Canvas */}
          <div style={{ ...glassPanel, marginBottom: 16, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 10 }}>Холст</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: '9x16', label: '9:16', desc: 'Reels' },
                { id: '1x1', label: '1:1', desc: 'Пост' },
                { id: '16x9', label: '16:9', desc: 'YouTube' },
              ].map(c => (
                <button key={c.id} onClick={() => setCanvas(c.id)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                  border: canvas === c.id ? `2px solid ${C.primary}` : '1px solid #E2EAE6',
                  background: canvas === c.id ? C.primaryLight : '#fff',
                  color: canvas === c.id ? C.primaryDark : C.gray600,
                  fontWeight: 700, fontSize: 13, textAlign: 'center',
                }}>
                  {c.label}<br /><span style={{ fontWeight: 400, fontSize: 11 }}>{c.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Audio */}
          <div style={{ ...glassPanel, marginBottom: 16, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 10 }}>
              <Music size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Аудиодорожка
            </h3>
            {audioFile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F1F5F9', borderRadius: 8, fontSize: 13, color: C.dark }}>
                <Music size={14} color={C.primary} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{audioFile.name}</span>
                <span style={{ color: C.gray400, fontSize: 11 }}>{(audioFile.size / 1024 / 1024).toFixed(1)} МБ</span>
                <button onClick={() => setAudioFile(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.gray400, padding: 0 }}><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => audioInputRef.current?.click()} style={{
                width: '100%', padding: '12px', borderRadius: 10, border: '1px dashed #C8D0CC',
                background: 'transparent', cursor: 'pointer', color: C.gray500, fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Upload size={14} /> Загрузить mp3/wav/m4a
              </button>
            )}
            <input ref={audioInputRef} type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,audio/*" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) setAudioFile(f); e.target.value = ''; }} />
            <p style={{ fontSize: 11, color: C.gray400, marginTop: 6 }}>Без аудио — немой ролик. До 20 МБ.</p>
          </div>

          {error && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#991B1B', fontSize: 13, fontWeight: 500 }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || selected.length === 0}
            style={{
              width: '100%', padding: '16px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: selected.length > 0 ? `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` : '#E2EAE6',
              color: selected.length > 0 ? '#fff' : C.gray400,
              fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: selected.length > 0 ? '0 8px 20px rgba(16,185,129,0.28)' : 'none',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? <Loader size={18} style={{ animation: 'va-spin 1s linear infinite' }} /> : <Video size={18} />}
            Склеить {selected.length > 0 ? `(${selected.length} клип${selected.length === 1 ? '' : selected.length < 5 ? 'а' : 'ов'})` : ''}
          </button>
          <p style={{ fontSize: 11, color: C.gray400, textAlign: 'center', marginTop: 8 }}>Бесплатно · до 10 клипов · до 120 сек</p>
        </div>
      </div>
    </div>
  );
}
