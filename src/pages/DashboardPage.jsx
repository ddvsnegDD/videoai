import { C } from '../lib/theme.js';

export default function DashboardPage() {
  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 80 }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: 32 }}>Мои проекты</h1>
      <div style={{
        background: C.white,
        border: `1px solid ${C.gray200}`,
        borderRadius: 20,
        padding: 48,
        textAlign: 'center',
      }}>
        <p style={{ color: C.gray500, marginBottom: 8 }}>У вас пока нет проектов</p>
        <p style={{ color: C.gray400, fontSize: '0.875rem' }}>Кабинет будет в Спринте 1</p>
      </div>
    </div>
  );
}
