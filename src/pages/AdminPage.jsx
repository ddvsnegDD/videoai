import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Activity, Plus, Minus, Shield, Trash2 } from 'lucide-react';
import { C } from '../lib/theme.js';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Btn from '../components/Btn.jsx';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creditInputs, setCreditInputs] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, email } or null
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    loadData();
  }, [user, tab]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'users') {
        const res = await api.get('/admin/users');
        setUsers(res.users);
      } else {
        const res = await api.get('/admin/jobs');
        setJobs(res.jobs);
      }
    } catch (err) {
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCredits(userId, amount) {
    try {
      const res = await api.post(`/admin/users/${userId}/credits`, { amount });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, credits: res.user.credits } : u));
      setCreditInputs(prev => ({ ...prev, [userId]: '' }));
    } catch (err) {
      alert('Ошибка: ' + (err.data?.error || err.message));
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/admin/users/${deleteTarget.id}`);
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const msg = err.data?.message || err.message || 'Ошибка удаления';
      alert(msg);
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading || !user || user.role !== 'admin') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 96, paddingBottom: 80, minHeight: '100vh', background: C.bg }}>
      <div className="container" style={{ maxWidth: 960 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <Shield size={22} color={C.primary} />
          <h1 style={{
            fontFamily: "'Manrope', sans-serif", fontSize: '1.75rem', fontWeight: 700,
            color: C.dark,
          }}>
            Админ-панель
          </h1>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <TabBtn active={tab === 'users'} onClick={() => setTab('users')}>
            <Users size={14} /> Пользователи
          </TabBtn>
          <TabBtn active={tab === 'jobs'} onClick={() => setTab('jobs')}>
            <Activity size={14} /> Задачи
          </TabBtn>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div className="spinner" />
          </div>
        ) : tab === 'users' ? (
          <div style={{
            background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 16,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: C.gray100 }}>
                  <Th>ID</Th>
                  <Th>Email</Th>
                  <Th align="center">Кредиты</Th>
                  <Th align="center">Проекты</Th>
                  <Th align="center">Роль</Th>
                  <Th>Дата</Th>
                  <Th>Действия</Th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                    <Td>{u.id}</Td>
                    <Td>
                      <span style={{ fontWeight: 500 }}>{u.email}</span>
                    </Td>
                    <Td align="center">
                      <span style={{
                        fontWeight: 700,
                        color: u.credits > 0 ? C.primary : C.danger,
                      }}>
                        {u.credits}
                      </span>
                    </Td>
                    <Td align="center">{u.projects_count}</Td>
                    <Td align="center">
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 5,
                        background: u.role === 'admin' ? C.primaryLight : C.gray100,
                        color: u.role === 'admin' ? C.primaryDark : C.gray500,
                      }}>
                        {u.role}
                      </span>
                    </Td>
                    <Td>{formatDate(u.created_at)}</Td>
                    <Td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          placeholder="0"
                          value={creditInputs[u.id] || ''}
                          onChange={e => setCreditInputs(prev => ({ ...prev, [u.id]: e.target.value }))}
                          style={{
                            width: 60,
                            padding: '4px 6px',
                            border: `1px solid ${C.gray200}`,
                            borderRadius: 6,
                            fontSize: '0.75rem',
                            textAlign: 'center',
                          }}
                        />
                        <button
                          onClick={() => {
                            const val = Number(creditInputs[u.id]);
                            if (val) handleCredits(u.id, val);
                          }}
                          style={{
                            ...miniBtn,
                            background: C.primaryLight,
                            color: C.primaryDark,
                          }}
                          title="Начислить"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={() => handleCredits(u.id, 100)}
                          style={{
                            ...miniBtn,
                            background: C.primaryLight,
                            color: C.primaryDark,
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            width: 'auto',
                            padding: '4px 8px',
                          }}
                          title="+100 кредитов"
                        >
                          +100
                        </button>
                        {u.id !== user.id && (
                          <button
                            onClick={() => setDeleteTarget({ id: u.id, email: u.email })}
                            style={{
                              ...miniBtn,
                              background: '#FEE2E2',
                              color: '#991B1B',
                              marginLeft: 4,
                            }}
                            title="Удалить аккаунт"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{
            background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 16,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: C.gray100 }}>
                  <Th>ID</Th>
                  <Th>Email</Th>
                  <Th>Тип</Th>
                  <Th align="center">Статус</Th>
                  <Th align="center">Кр.</Th>
                  <Th>Ошибка</Th>
                  <Th>Дата</Th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                    <Td>{j.id}</Td>
                    <Td>
                      <span style={{ fontSize: '0.75rem' }}>{j.user_email}</span>
                    </Td>
                    <Td>
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: j.type === 'storyboard' ? '#DBEAFE' : j.type === 'regenerate_scene' ? '#FEF3C7' : C.gray100,
                        color: j.type === 'storyboard' ? '#1E40AF' : j.type === 'regenerate_scene' ? '#92400E' : C.gray600,
                      }}>
                        {j.type}
                      </span>
                    </Td>
                    <Td align="center">
                      <StatusBadge status={j.status} />
                    </Td>
                    <Td align="center">{j.cost_credits}</Td>
                    <Td>
                      {j.error && (
                        <span style={{ color: C.danger, fontSize: '0.6875rem' }} title={j.error}>
                          {j.error.slice(0, 40)}{j.error.length > 40 ? '…' : ''}
                        </span>
                      )}
                    </Td>
                    <Td>{formatDate(j.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Delete confirmation modal */}
        {deleteTarget && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => !deleting && setDeleteTarget(null)}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 16, padding: '28px 32px', maxWidth: 420, width: '90%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: '1.125rem', fontWeight: 700, color: C.dark }}>
                Удалить аккаунт?
              </h3>
              <p style={{ margin: '0 0 8px', fontSize: '0.875rem', color: C.gray600, lineHeight: 1.5 }}>
                <strong>{deleteTarget.email}</strong>
              </p>
              <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: '#991B1B', lineHeight: 1.5 }}>
                Действие необратимо. Вместе с аккаунтом удалятся все его проекты, клипы, папки и сборки.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  style={{
                    padding: '10px 20px', borderRadius: 10, border: `1px solid ${C.gray200}`,
                    background: '#fff', color: C.gray600, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deleting}
                  style={{
                    padding: '10px 20px', borderRadius: 10, border: 'none',
                    background: '#DC2626', color: '#fff', fontWeight: 700, fontSize: '0.875rem',
                    cursor: deleting ? 'wait' : 'pointer', opacity: deleting ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Trash2 size={14} />
                  {deleting ? 'Удаление...' : 'Удалить'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 10,
        border: `1px solid ${active ? C.primary : C.gray200}`,
        background: active ? C.primaryLight : C.white,
        color: active ? C.primaryDark : C.gray500,
        fontWeight: 600, fontSize: '0.8125rem',
        cursor: 'pointer', transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const colors = {
    done: { bg: '#D1FAE5', color: '#065F46' },
    failed: { bg: '#FEE2E2', color: '#991B1B' },
    running: { bg: '#DBEAFE', color: '#1E40AF' },
    pending: { bg: C.gray100, color: C.gray500 },
  };
  const c = colors[status] || colors.pending;
  return (
    <span style={{
      fontSize: '0.6875rem', fontWeight: 600,
      padding: '2px 8px', borderRadius: 5,
      background: c.bg, color: c.color,
    }}>
      {status}
    </span>
  );
}

function Th({ children, align = 'left' }) {
  return (
    <th style={{
      padding: '10px 12px', textAlign: align,
      fontWeight: 600, color: C.gray500,
      fontSize: '0.75rem', textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }) {
  return (
    <td style={{ padding: '10px 12px', textAlign: align, verticalAlign: 'middle' }}>
      {children}
    </td>
  );
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const miniBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 6,
  border: 'none', cursor: 'pointer',
  transition: 'opacity 0.2s',
};
