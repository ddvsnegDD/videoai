import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video, FolderPlus, FolderOpen, Pencil, Trash2, Download,
  MoreVertical, Film, Loader, X, Check, ChevronRight, Scissors,
} from 'lucide-react';
import { C } from '../lib/theme';
import { api } from '../lib/api';

const glassPanel = {
  background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(16,185,129,0.12)', borderRadius: 20,
  boxShadow: '0 16px 32px rgba(10,46,31,0.03)', padding: 24,
};

function ClipCard({ clip, folders, onMoved, onRenamed, onDeleted }) {
  const v = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(clip.title || '');
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef(null);
  const titleInputRef = useRef(null);
  const isVeo = clip.model === 'veo';
  const date = clip.created_at
    ? new Date(clip.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  useEffect(() => {
    const el = v.current;
    if (!el) return;
    const seek = () => { try { el.currentTime = 2.3; } catch {} };
    el.addEventListener('loadeddata', seek);
    return () => el.removeEventListener('loadeddata', seek);
  }, [clip.video_url]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  useEffect(() => { if (editing) titleInputRef.current?.focus(); }, [editing]);

  async function saveTitle() {
    const trimmed = editTitle.trim().slice(0, 80);
    setEditing(false);
    if (trimmed && trimmed !== clip.title) {
      try {
        await api.patch(`/clips/${clip.id}`, { title: trimmed });
        onRenamed(clip.id, trimmed);
      } catch {}
    } else {
      setEditTitle(clip.title || '');
    }
  }

  async function moveToFolder(folderId) {
    try {
      await api.patch(`/clips/${clip.id}`, { folder_id: folderId });
      onMoved(clip.id, folderId);
    } catch {}
    setMenuOpen(false);
  }

  async function handleDelete() {
    if (!window.confirm('Удалить клип? Действие необратимо.')) return;
    setDeleting(true);
    try {
      await api.del(`/projects/${clip.id}`);
      onDeleted(clip.id);
    } catch (err) {
      const msg = err?.error === 'active_generation'
        ? 'Дождитесь завершения генерации перед удалением'
        : 'Не удалось удалить клип';
      alert(msg);
    }
    setDeleting(false);
    setMenuOpen(false);
  }

  return (
    <div
      onMouseEnter={() => { setHovered(true); v.current?.play().catch(() => {}); }}
      onMouseLeave={() => { setHovered(false); if (v.current) { v.current.pause(); try { v.current.currentTime = 2.3; } catch {} } }}
      style={{
        background: '#fff', borderRadius: 16, border: '1px solid #E2EAE6',
        boxShadow: hovered ? '0 8px 24px rgba(10,46,31,0.10)' : '0 4px 12px rgba(10,46,31,0.03)',
        position: 'relative', transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        zIndex: menuOpen ? 50 : 'auto',
      }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: '#0a1f16', display: 'grid', placeItems: 'center', overflow: 'hidden', borderRadius: '16px 16px 0 0' }}>
        <video ref={v} src={clip.video_url} muted loop playsInline preload="auto" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'relative', zIndex: 2, width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', display: 'grid', placeItems: 'center', color: C.dark, boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
          <Video size={16} fill="currentColor" style={{ marginLeft: 2 }} />
        </div>
        <div style={{ position: 'absolute', top: 11, left: 11, zIndex: 3, background: isVeo ? 'rgba(99,102,241,0.92)' : 'rgba(10,46,31,0.82)', color: '#fff', padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
          {isVeo ? 'Veo 3.1' : 'Kling 2.5'}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          {editing ? (
            <input
              ref={titleInputRef}
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditTitle(clip.title || ''); setEditing(false); } }}
              onBlur={saveTitle}
              maxLength={80}
              style={{ flex: 1, fontSize: 15, fontWeight: 600, color: C.dark, border: `1px solid ${C.primary}`, borderRadius: 6, padding: '2px 6px', outline: 'none', minWidth: 0 }}
            />
          ) : (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: C.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{clip.title}</h3>
              <button
                onClick={e => { e.stopPropagation(); setEditTitle(clip.title || ''); setEditing(true); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.gray400, padding: 2, display: 'grid', flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}
                title="Переименовать"
              >
                <Pencil size={13} />
              </button>
            </>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: '#6B7F74', marginBottom: 14 }}>{date}</div>
        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
          <a href={clip.video_url} download target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, textDecoration: 'none' }}>
            <button style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: '#F1F5F9', color: C.dark, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Download size={14} /> Скачать
            </button>
          </a>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: '#F1F5F9', color: C.gray600, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, bottom: '100%', marginBottom: 4, zIndex: 100,
                background: '#fff', borderRadius: 12, border: '1px solid #E2EAE6',
                boxShadow: '0 8px 24px rgba(10,46,31,0.12)', minWidth: 180, padding: 6, fontSize: 13,
              }}>
                {clip.folder_id && (
                  <button onClick={() => moveToFolder(null)} style={menuItemStyle}>
                    <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> В корень
                  </button>
                )}
                {folders.filter(f => f.id !== clip.folder_id).map(f => (
                  <button key={f.id} onClick={() => moveToFolder(f.id)} style={menuItemStyle}>
                    <FolderOpen size={14} /> {f.name}
                  </button>
                ))}
                {folders.length === 0 && !clip.folder_id && (
                  <div style={{ padding: '8px 12px', color: C.gray400, fontSize: 12 }}>Нет папок</div>
                )}
                <div style={{ borderTop: '1px solid #F1F5F9', margin: '4px 0' }} />
                <button onClick={handleDelete} disabled={deleting} style={{ ...menuItemStyle, color: '#EF4444' }}>
                  <Trash2 size={14} /> {deleting ? 'Удаление…' : 'Удалить'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssemblyCard({ assembly, folders, onMoved, onDeleted }) {
  const v = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef(null);
  const date = assembly.created_at
    ? new Date(assembly.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';
  const canvasLabel = { '9x16': '9:16', '1x1': '1:1', '16x9': '16:9' }[assembly.canvas] || assembly.canvas;

  useEffect(() => {
    const el = v.current;
    if (!el) return;
    const seek = () => { try { el.currentTime = 1; } catch {} };
    el.addEventListener('loadeddata', seek);
    return () => el.removeEventListener('loadeddata', seek);
  }, [assembly.output_url]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  async function moveToFolder(folderId) {
    try {
      await api.patch(`/assemblies/${assembly.id}`, { folder_id: folderId });
      onMoved(assembly.id, folderId);
    } catch {}
    setMenuOpen(false);
  }

  async function handleDelete() {
    if (!window.confirm('Удалить сборку? Видео и файлы удалятся безвозвратно.')) return;
    setDeleting(true);
    try {
      await api.del(`/assemblies/${assembly.id}`);
      onDeleted(assembly.id);
    } catch (err) {
      const msg = err?.error === 'assembly_processing'
        ? 'Дождитесь завершения сборки перед удалением'
        : 'Не удалось удалить сборку';
      alert(msg);
    }
    setDeleting(false);
    setMenuOpen(false);
  }

  return (
    <div
      onMouseEnter={() => { setHovered(true); v.current?.play().catch(() => {}); }}
      onMouseLeave={() => { setHovered(false); if (v.current) { v.current.pause(); try { v.current.currentTime = 1; } catch {} } }}
      style={{
        background: '#fff', borderRadius: 16, border: '1px solid #E2EAE6',
        boxShadow: hovered ? '0 8px 24px rgba(10,46,31,0.10)' : '0 4px 12px rgba(10,46,31,0.03)',
        position: 'relative', transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        zIndex: menuOpen ? 50 : 'auto',
      }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: '#0a1f16', display: 'grid', placeItems: 'center', overflow: 'hidden', borderRadius: '16px 16px 0 0' }}>
        {assembly.output_url ? (
          <video ref={v} src={assembly.output_url} muted loop playsInline preload="auto" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Film size={32} color="#fff" style={{ opacity: 0.4 }} />
        )}
        <div style={{ position: 'relative', zIndex: 2, width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', display: 'grid', placeItems: 'center', color: C.dark, boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
          <Video size={16} fill="currentColor" style={{ marginLeft: 2 }} />
        </div>
        <div style={{ position: 'absolute', top: 11, left: 11, zIndex: 3, background: 'rgba(234,88,12,0.92)', color: '#fff', padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Scissors size={11} /> Склеено
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', color: C.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Склейка {canvasLabel} · {assembly.clip_count} кл.
        </h3>
        <div style={{ fontSize: 12.5, color: '#6B7F74', marginBottom: 14 }}>{date}</div>
        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
          <a href={assembly.output_url} download target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, textDecoration: 'none' }}>
            <button style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: '#F1F5F9', color: C.dark, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Download size={14} /> Скачать
            </button>
          </a>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: '#F1F5F9', color: C.gray600, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, bottom: '100%', marginBottom: 4, zIndex: 100,
                background: '#fff', borderRadius: 12, border: '1px solid #E2EAE6',
                boxShadow: '0 8px 24px rgba(10,46,31,0.12)', minWidth: 180, padding: 6, fontSize: 13,
              }}>
                {assembly.folder_id && (
                  <button onClick={() => moveToFolder(null)} style={menuItemStyle}>
                    <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> В корень
                  </button>
                )}
                {folders.filter(f => f.id !== assembly.folder_id).map(f => (
                  <button key={f.id} onClick={() => moveToFolder(f.id)} style={menuItemStyle}>
                    <FolderOpen size={14} /> {f.name}
                  </button>
                ))}
                {folders.length === 0 && !assembly.folder_id && (
                  <div style={{ padding: '8px 12px', color: C.gray400, fontSize: 12 }}>Нет папок</div>
                )}
                <div style={{ borderTop: '1px solid #F1F5F9', margin: '4px 0' }} />
                <button onClick={handleDelete} disabled={deleting} style={{ ...menuItemStyle, color: '#EF4444' }}>
                  <Trash2 size={14} /> {deleting ? 'Удаление…' : 'Удалить'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const menuItemStyle = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  padding: '8px 12px', border: 'none', background: 'none', borderRadius: 8,
  cursor: 'pointer', color: '#334155', fontSize: 13, fontWeight: 500,
  textAlign: 'left',
};

function FolderChip({ folder, active, onClick, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const inputRef = useRef(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function save() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== folder.name) onRename(folder.id, trimmed);
    else setName(folder.name);
    setEditing(false);
  }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', borderRadius: 10,
      background: active ? C.primaryLight : '#fff',
      border: `1px solid ${active ? C.primary : '#E2EAE6'}`,
      cursor: editing ? 'text' : 'pointer',
      fontSize: 13.5, fontWeight: 600, color: active ? C.primaryDark : C.gray600,
      transition: 'all 0.15s',
    }}>
      <FolderOpen size={14} />
      {editing ? (
        <>
          <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setName(folder.name); setEditing(false); } }}
            onBlur={save}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5, fontWeight: 600, color: 'inherit', width: Math.max(40, name.length * 8) }}
          />
          <button onClick={save} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.primary, padding: 0, display: 'grid' }}><Check size={13} /></button>
        </>
      ) : (
        <>
          <span onClick={onClick}>{folder.name}</span>
          <span style={{ color: C.gray400, fontWeight: 400, fontSize: 12 }}>({(folder.clip_count || 0) + (folder.assembly_count || 0)})</span>
          <button onClick={e => { e.stopPropagation(); setEditing(true); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.gray400, padding: 0, display: 'grid' }}><Pencil size={12} /></button>
          <button onClick={e => { e.stopPropagation(); onDelete(folder.id); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: 0, display: 'grid' }}><Trash2 size={12} /></button>
        </>
      )}
    </div>
  );
}

export default function LibraryPage() {
  const navigate = useNavigate();
  const [clips, setClips] = useState([]);
  const [assemblies, setAssemblies] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/clips').then(d => setClips(d.clips || [])),
      api.get('/assemblies').then(d => setAssemblies(d.assemblies || [])),
      api.get('/folders').then(d => setFolders(d.folders || [])),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function createFolder() {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const { folder } = await api.post('/folders', { name: newFolderName.trim() });
      setFolders(prev => [{ ...folder, clip_count: 0, assembly_count: 0 }, ...prev]);
      setNewFolderName('');
    } catch {}
    setCreatingFolder(false);
  }

  async function renameFolder(id, name) {
    try {
      await api.patch(`/folders/${id}`, { name });
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
    } catch {}
  }

  async function deleteFolder(id) {
    try {
      await api.del(`/folders/${id}`);
      setFolders(prev => prev.filter(f => f.id !== id));
      setClips(prev => prev.map(c => c.folder_id === id ? { ...c, folder_id: null } : c));
      setAssemblies(prev => prev.map(a => a.folder_id === id ? { ...a, folder_id: null } : a));
      if (activeFolder === id) setActiveFolder(null);
    } catch {}
  }

  function handleClipRenamed(clipId, newTitle) {
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, title: newTitle } : c));
  }

  function handleClipDeleted(clipId) {
    const deleted = clips.find(c => c.id === clipId);
    setClips(prev => prev.filter(c => c.id !== clipId));
    if (deleted?.folder_id) {
      setFolders(prev => prev.map(f =>
        f.id === deleted.folder_id ? { ...f, clip_count: Math.max(0, f.clip_count - 1) } : f
      ));
    }
  }

  function handleClipMoved(clipId, folderId) {
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, folder_id: folderId } : c));
    setFolders(prev => prev.map(f => {
      let count = f.clip_count;
      if (f.id === folderId) count++;
      const oldFolder = clips.find(c => c.id === clipId)?.folder_id;
      if (f.id === oldFolder) count--;
      return { ...f, clip_count: Math.max(0, count) };
    }));
  }

  function handleAssemblyDeleted(assemblyId) {
    const deleted = assemblies.find(a => a.id === assemblyId);
    setAssemblies(prev => prev.filter(a => a.id !== assemblyId));
    if (deleted?.folder_id) {
      setFolders(prev => prev.map(f =>
        f.id === deleted.folder_id ? { ...f, assembly_count: Math.max(0, (f.assembly_count || 0) - 1) } : f
      ));
    }
  }

  function handleAssemblyMoved(assemblyId, folderId) {
    const oldFolder = assemblies.find(a => a.id === assemblyId)?.folder_id;
    setAssemblies(prev => prev.map(a => a.id === assemblyId ? { ...a, folder_id: folderId } : a));
    setFolders(prev => prev.map(f => {
      let count = f.assembly_count || 0;
      if (f.id === folderId) count++;
      if (f.id === oldFolder) count--;
      return { ...f, assembly_count: Math.max(0, count) };
    }));
  }

  const filteredClips = activeFolder ? clips.filter(c => c.folder_id === activeFolder) : clips;
  const filteredAssemblies = activeFolder ? assemblies.filter(a => a.folder_id === activeFolder) : assemblies;
  const filtered = [
    ...filteredClips.map(c => ({ ...c, _type: 'clip' })),
    ...filteredAssemblies.map(a => ({ ...a, _type: 'assembly' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '36px 24px 64px' }}>
      <style>{`@keyframes va-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ ...glassPanel, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 24, fontWeight: 800, margin: '0 0 4px', color: C.dark, letterSpacing: '-0.02em' }}>Библиотека клипов</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#46594F' }}>Все готовые видеокреативы в одном месте</p>
        </div>
        <button onClick={() => navigate('/editor')} style={{
          background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: '#fff',
          border: 'none', cursor: 'pointer', padding: '14px 24px', borderRadius: 11,
          fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 8px 20px rgba(16,185,129,0.28)',
        }}>
          <Video size={18} /> Создать клип
        </button>
      </div>

      {/* Folders bar */}
      <div style={{ ...glassPanel, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div
          onClick={() => setActiveFolder(null)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
            background: !activeFolder ? C.primaryLight : '#fff',
            border: `1px solid ${!activeFolder ? C.primary : '#E2EAE6'}`,
            cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
            color: !activeFolder ? C.primaryDark : C.gray600,
          }}
        >
          Все клипы <span style={{ color: C.gray400, fontWeight: 400, fontSize: 12 }}>({clips.length + assemblies.length})</span>
        </div>

        {folders.map(f => (
          <FolderChip key={f.id} folder={f} active={activeFolder === f.id}
            onClick={() => setActiveFolder(activeFolder === f.id ? null : f.id)}
            onRename={renameFolder} onDelete={deleteFolder}
          />
        ))}

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createFolder(); }}
            placeholder="Новая папка…"
            style={{ border: '1px solid #E2EAE6', borderRadius: 8, padding: '7px 12px', fontSize: 13, width: 130, outline: 'none' }}
          />
          <button
            onClick={createFolder}
            disabled={creatingFolder || !newFolderName.trim()}
            style={{
              border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer',
              background: newFolderName.trim() ? C.primary : '#E2EAE6',
              color: newFolderName.trim() ? '#fff' : C.gray400, display: 'grid', placeItems: 'center',
            }}
          >
            <FolderPlus size={16} />
          </button>
        </div>
      </div>

      {/* Clips grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
          <Loader size={32} color={C.primary} style={{ animation: 'va-spin 1s linear infinite' }} />
        </div>
      ) : filtered.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(264px, 1fr))', gap: 22 }}>
          {filtered.map(item => item._type === 'assembly'
            ? <AssemblyCard key={`asm-${item.id}`} assembly={item} folders={folders} onMoved={handleAssemblyMoved} onDeleted={handleAssemblyDeleted} />
            : <ClipCard key={`clip-${item.id}`} clip={item} folders={folders} onMoved={handleClipMoved} onRenamed={handleClipRenamed} onDeleted={handleClipDeleted} />
          )}
        </div>
      ) : (
        <div style={{ ...glassPanel, textAlign: 'center', padding: '64px 32px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F1F5F9', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: '#64748B' }}>
            <Film size={28} />
          </div>
          <h2 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 20, fontWeight: 800, color: C.dark, marginBottom: 8 }}>
            {activeFolder ? 'Папка пуста' : 'Клипов пока нет'}
          </h2>
          <p style={{ fontSize: 14, color: '#6B7F74', maxWidth: 400, margin: '0 auto 24px', lineHeight: 1.5 }}>
            {activeFolder ? 'Переместите клипы в эту папку через меню на карточке' : 'Создайте первый видеокреатив в редакторе'}
          </p>
          {!activeFolder && (
            <button onClick={() => navigate('/editor')} style={{
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: '#fff',
              border: 'none', cursor: 'pointer', padding: '14px 28px', borderRadius: 11,
              fontSize: 16, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 10px 24px rgba(16,185,129,0.28)',
            }}>
              <Video size={18} /> Создать клип
            </button>
          )}
        </div>
      )}
    </div>
  );
}
