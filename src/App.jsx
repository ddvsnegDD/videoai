// src/App.jsx
import React, { Component } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { isAdmin } from './lib/adminConfig';

import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EditorPage from './pages/EditorPage';
import ProjectPage from './pages/ProjectPage';
import BillingPage from './pages/BillingPage';
import AdminPage from './pages/AdminPage';

/* ── ErrorBoundary (ловит рендер-ошибки, не даёт белый экран) ── */
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(err, info) { console.error('ErrorBoundary caught:', err, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 32, textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8, color: '#0A2E1F' }}>Что-то пошло не так</h2>
          <p style={{ color: '#6B7280', marginBottom: 16, fontSize: '0.875rem' }}>Попробуйте обновить страницу</p>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: '#10B981', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            Обновить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Гейт раздела «Админ»: пускает только пользователей,
 * чья почта есть в ADMIN_EMAILS (см. lib/adminConfig.js).
 * Остальных — на дашборд (или /login, если не авторизован).
 */
function AdminRoute({ children }) {
  const auth = useAuth();
  const user = auth?.user;
  if (auth?.loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin(user)) return <Navigate to="/dashboard" replace />;
  return children;
}

/**
 * Защита кабинетных страниц: не авторизован → /login.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            {/* Гостевой слой */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Кабинет селлера */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/editor" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
            <Route path="/project/:id" element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />

            {/* Админка — только для ADMIN_EMAILS */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
}
