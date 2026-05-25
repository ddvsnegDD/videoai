import { Link, useLocation } from 'react-router-dom';
import { Play, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { C } from '../lib/theme.js';
import Btn from './Btn.jsx';

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header isLanding={isLanding} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main style={{ flex: 1 }}>{children}</main>
      {isLanding && <Footer />}
    </div>
  );
}

function Header({ isLanding, menuOpen, setMenuOpen }) {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(247, 250, 248, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${C.gray200}`,
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: C.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Play size={18} color={C.white} fill={C.white} />
          </div>
          <span style={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 800,
            fontSize: '1.25rem',
            color: C.dark,
          }}>
            Video<span style={{ color: C.primary }}>AI</span>
          </span>
        </Link>

        {isLanding && (
          <>
            <nav style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="desktop-nav">
              <a href="#features" style={{ color: C.gray600, fontSize: '0.9375rem', fontWeight: 500 }}>Возможности</a>
              <a href="#pricing" style={{ color: C.gray600, fontSize: '0.9375rem', fontWeight: 500 }}>Тарифы</a>
              <a href="#faq" style={{ color: C.gray600, fontSize: '0.9375rem', fontWeight: 500 }}>FAQ</a>
            </nav>
            <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link to="/login"><Btn variant="outline" size="sm">Войти</Btn></Link>
              <Link to="/login"><Btn variant="primary" size="sm">Начать бесплатно</Btn></Link>
            </div>
            <button
              className="mobile-menu-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                display: 'none',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: C.dark,
              }}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </>
        )}

        {!isLanding && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/dashboard"><Btn variant="outline" size="sm">Кабинет</Btn></Link>
          </div>
        )}
      </div>

      {menuOpen && isLanding && (
        <div className="mobile-menu" style={{
          padding: '16px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          borderTop: `1px solid ${C.gray200}`,
        }}>
          <a href="#features" onClick={() => setMenuOpen(false)} style={{ color: C.gray600, fontWeight: 500 }}>Возможности</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)} style={{ color: C.gray600, fontWeight: 500 }}>Тарифы</a>
          <a href="#faq" onClick={() => setMenuOpen(false)} style={{ color: C.gray600, fontWeight: 500 }}>FAQ</a>
          <Link to="/login" onClick={() => setMenuOpen(false)}><Btn variant="primary" size="md" style={{ width: '100%' }}>Начать бесплатно</Btn></Link>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer style={{ background: C.dark, color: C.white, padding: '48px 0 32px' }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 40,
          marginBottom: 40,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: C.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Play size={16} color={C.white} fill={C.white} />
              </div>
              <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: '1.125rem' }}>
                Video<span style={{ color: C.primary }}>AI</span>
              </span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              AI-генерация видео для соцсетей. Российский стек, оплата в рублях.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 16, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Продукт</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#features" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9375rem' }}>Возможности</a>
              <a href="#pricing" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9375rem' }}>Тарифы</a>
              <a href="#faq" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9375rem' }}>FAQ</a>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 16, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Правовое</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9375rem' }}>Политика конфиденциальности</a>
              <a href="#" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9375rem' }}>Оферта</a>
            </div>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: 24,
          textAlign: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '0.8125rem',
        }}>
          &copy; {new Date().getFullYear()} VideoAI. Все права защищены.
        </div>
      </div>
    </footer>
  );
}
