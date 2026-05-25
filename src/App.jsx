import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout.jsx';

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
    <Layout>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/editor/:id" element={<EditorPage />} />
          <Route path="/project/:id" element={<ProjectPage />} />
          <Route path="/publish/:id" element={<PublishPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
