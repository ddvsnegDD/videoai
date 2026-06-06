import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw, Film, Clock, Play, Trash2, Music, Upload, Volume2, VolumeX } from 'lucide-react';
import { C } from '../lib/theme.js';
import { api } from '../lib/api.js';
import Btn from '../components/Btn.jsx';

export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Audio overlay state
  const [audioFile, setAudioFile] = useState(null);
  const [mixing, setMixing] = useState(false);
  const [mixError, setMixError] = useState('');
  const [showWithAudio, setShowWithAudio] = useState(true);
  const audioInputRef = useRef(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.del(`/projects/${id}`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.status === 409) {
        setDeleteError('Дождитесь завершения генерации');
      } else {
        setDeleteError('Ошибка удаления');
      }
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

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
  const audioVideoUrl = brief?.audio_video_url;
  const imageUrl = brief?.image_url;
  const date = new Date(project.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  // Which video to show in player
  const activeVideoUrl = (audioVideoUrl && showWithAudio) ? audioVideoUrl : videoUrl;

  async function handleAudioUpload() {
    if (!audioFile) return;
    setMixing(true);
    setMixError('');
    try {
      const fd = new FormData();
      fd.append('audio', audioFile);
      const res = await fetch(`/api/projects/${id}/audio`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        const messages = {
          no_audio_file: 'Файл не выбран',
          no_video: 'У проекта нет готового видео',
          mix_in_progress: 'Микс уже идёт, подождите',
          mix_failed: 'Ошибка наложения звука',
          unsupported_audio_type: 'Неподдерживаемый формат аудио',
        };
        throw new Error(messages[data.error] || data.message || 'Ошибка');
      }
      // Update project brief locally
      const updatedBrief = { ...brief, audio_video_url: data.audio_video_url };
      setProject(prev => ({ ...prev, brief: updatedBrief }));
      setShowWithAudio(true);
      setAudioFile(null);
      if (audioInputRef.current) audioInputRef.current.value = '';
    } catch (err) {
      setMixError(err.message || 'Ошибка наложения звука');
    } finally {
      setMixing(false);
    }
  }

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
              key={activeVideoUrl}
              controls
              src={activeVideoUrl}
              poster={imageUrl}
              style={{ width: '100%', maxWidth: 400, borderRadius: 16, marginBottom: 12, background: '#000' }}
            />

            {/* Audio version toggle */}
            {audioVideoUrl && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                <button
                  onClick={() => setShowWithAudio(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '6px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${showWithAudio ? C.primary : C.gray200}`,
                    background: showWithAudio ? C.primaryLight : 'transparent',
                    color: showWithAudio ? C.primaryDark : C.gray500,
                  }}
                >
                  <Volume2 size={13} /> Со звуком
                </button>
                <button
                  onClick={() => setShowWithAudio(false)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '6px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${!showWithAudio ? C.primary : C.gray200}`,
                    background: !showWithAudio ? C.primaryLight : 'transparent',
                    color: !showWithAudio ? C.primaryDark : C.gray500,
                  }}
                >
                  <VolumeX size={13} /> Оригинал
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={activeVideoUrl} download target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
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

            {/* Audio overlay section */}
            <div style={{
              marginTop: 24, padding: 20, borderRadius: 14,
              background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(16px)',
              border: `1px solid ${C.gray200}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Music size={16} color={C.primaryDark} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.dark }}>Добавить музыку</span>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                  border: `1px dashed ${C.gray200}`, fontSize: '0.8125rem', color: C.gray500,
                  background: audioFile ? C.primaryLight : 'transparent',
                  transition: 'all 0.15s',
                }}>
                  <Upload size={14} />
                  {audioFile ? audioFile.name.slice(0, 25) : 'Выбрать файл'}
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/aac,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/ogg"
                    style={{ display: 'none' }}
                    onChange={e => { setAudioFile(e.target.files?.[0] || null); setMixError(''); }}
                  />
                </label>

                <Btn
                  variant="primary"
                  size="sm"
                  disabled={!audioFile || mixing}
                  onClick={handleAudioUpload}
                >
                  {mixing ? 'Накладываю звук…' : 'Наложить'}
                </Btn>
              </div>

              <p style={{ fontSize: '0.6875rem', color: C.gray400, marginTop: 8, marginBottom: 0 }}>
                MP3, AAC, WAV или OGG, до 20 МБ. Музыка обрежется по длине ролика.
              </p>

              {mixError && (
                <p style={{ fontSize: '0.8125rem', color: '#EF4444', marginTop: 8, marginBottom: 0 }}>{mixError}</p>
              )}
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

        {/* Delete section */}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          {deleteError && (
            <p style={{ color: '#EF4444', fontSize: '0.8125rem', marginBottom: 12 }}>{deleteError}</p>
          )}
          {confirmDelete ? (
            <div style={{
              background: C.white, border: '1px solid #FECACA', borderRadius: 14, padding: 20,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            }}>
              <p style={{ fontSize: '0.875rem', color: C.dark, fontWeight: 500 }}>
                Удалить креатив? Видео и файлы удалятся безвозвратно.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn variant="outline" size="sm" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                  Отмена
                </Btn>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: '#EF4444', color: '#fff', fontSize: '0.8125rem', fontWeight: 600,
                    opacity: deleting ? 0.5 : 1,
                  }}
                >
                  {deleting ? 'Удаление...' : 'Да, удалить'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: C.gray400, fontSize: '0.75rem', display: 'inline-flex',
                alignItems: 'center', gap: 4, transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
              onMouseLeave={e => e.currentTarget.style.color = C.gray400}
            >
              <Trash2 size={12} /> Удалить проект
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
