import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense, Component } from 'react';
import { AuthProvider } from './lib/auth.jsx';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

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
    <ErrorBoundary>
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
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          </Routes>
        </Suspense>
      </Layout>
    </AuthProvider>
    </ErrorBoundary>
  );
}
