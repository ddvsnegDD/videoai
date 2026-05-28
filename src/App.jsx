import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './lib/auth.jsx';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const EditorPage = lazy(() => import('./pages/EditorPage.jsx'));
const ProjectPage = lazy(() => import('./pages/ProjectPage.jsx'));
const PublishPage = lazy(() => import('./pages/PublishPage.jsx'));
const BillingPage = lazy(() => import('./pages/BillingPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="spinner" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/editor" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
            <Route path="/editor/:id" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
            <Route path="/project/:id" element={<ProtectedRoute><ProjectPage /></ProtectedRoute>} />
            <Route path="/publish/:id" element={<ProtectedRoute><PublishPage /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </AuthProvider>
  );
}
