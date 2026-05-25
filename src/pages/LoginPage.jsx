import { C } from '../lib/theme.js';

export default function LoginPage() {
  return (
    <div className="container" style={{ paddingTop: 80, paddingBottom: 80, maxWidth: 420, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', textAlign: 'center', marginBottom: 8 }}>Войти в VideoAI</h1>
      <p className="text-muted" style={{ textAlign: 'center', marginBottom: 32 }}>Введите email — мы отправим код</p>
      <div style={{
        background: C.white,
        border: `1px solid ${C.gray200}`,
        borderRadius: 20,
        padding: 32,
      }}>
        <p className="text-muted text-center">Авторизация будет в Спринте 1</p>
      </div>
    </div>
  );
}
