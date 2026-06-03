// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { isAdmin } from './lib/adminConfig';

import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EditorPage from './pages/EditorPage';
import BillingPage from './pages/BillingPage';
import AdminPage from './pages/AdminPage';

/**
 * Гейт раздела «Админ»: пускает только пользователей,
 * чья почта есть в ADMIN_EMAILS (см. lib/adminConfig.js).
 * Остальных — на дашборд (или /login, если не авторизован).
 */
function AdminRoute({ children }) {
  const auth = useAuth();
  const user = auth?.user;
  if (auth?.loading) return null; // если в твоём useAuth есть флаг loading
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin(user)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            {/* Гостевой слой */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Кабинет селлера */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/editor" element={<EditorPage />} />
            <Route path="/billing" element={<BillingPage />} />

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
      </BrowserRouter>
    </AuthProvider>
  );
}
