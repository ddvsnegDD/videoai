import { Link, useLocation } from 'react-router-dom';
import { Play, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { C } from '../lib/theme.js';
import Btn from './Btn.jsx';

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isLanding = location.pathname === '/';

  useEffect(() => { setMenuOpen(false); }, [location]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header isLanding={isLanding} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main style={{ flex: 1 }}>{children}</main>
      {isLanding && <Footer />}
    </div>
  );
}

function Header({ isLanding, menuOpen, setMenuOpen }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: scrolled ? 'rgba(248, 250, 249, 0.85)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px) saturate(1.2)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(1.2)' : 'none',
      borderBottom: scrolled ? `1px solid ${C.gray200}` : '1px solid transparent',
      transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <div className="container-lg" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 72,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(16, 185, 129, 0.25)',
          }}>
            <Play size={17} color={C.white} fill={C.white} style={{ marginLeft: 2 }} />
          </div>
          <span style={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 800,
            fontSize: '1.3rem',
            color: C.dark,
            letterSpacing: '-0.02em',
          }}>
            Video<span style={{ color: C.primary }}>AI</span>
          </span>
        </Link>

        {isLanding && (
          <>
            <nav style={{ display: 'flex', alignItems: 'center', gap: 36 }} className="desktop-nav">
              {[
                ['#how', 'Как работает'],
                ['#features', 'Возможности'],
                ['#pricing', 'Тарифы'],
                ['#faq', 'FAQ'],
              ].map(([href, label]) => (
                <a key={href} href={href} style={{
                  color: C.gray600,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'color 0.2s',
                  letterSpacing: '0.01em',
                }}>{label}</a>
              ))}
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
                padding: 4,
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
        <div style={{
          padding: '12px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'rgba(248, 250, 249, 0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: `1px solid ${C.gray200}`,
        }}>
          {[['#how', 'Как работает'], ['#features', 'Возможности'], ['#pricing', 'Тарифы'], ['#faq', 'FAQ']].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)} style={{ color: C.gray600, fontWeight: 500, fontSize: '0.9375rem', padding: '4px 0' }}>{label}</a>
          ))}
          <Link to="/login" onClick={() => setMenuOpen(false)}>
            <Btn variant="primary" size="md" style={{ width: '100%' }}>Начать бесплатно</Btn>
          </Link>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer style={{
      background: C.dark,
      color: C.white,
      padding: '56px 0 36px',
      borderTop: `1px solid ${C.darkBorder}`,
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 40,
          marginBottom: 40,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Play size={14} color={C.white} fill={C.white} style={{ marginLeft: 1 }} />
              </div>
              <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: '1.1rem' }}>
                Video<span style={{ color: C.primary }}>AI</span>
              </span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8125rem', lineHeight: 1.6, maxWidth: 240 }}>
              AI-генерация видео для соцсетей. Российский стек, оплата в рублях.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 16, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Продукт</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#features" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>Возможности</a>
              <a href="#pricing" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>Тарифы</a>
              <a href="#faq" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>FAQ</a>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 16, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Правовое</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>Конфиденциальность</a>
              <a href="#" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>Оферта</a>
            </div>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingTop: 24,
          textAlign: 'center',
          color: 'rgba(255,255,255,0.3)',
          fontSize: '0.75rem',
          letterSpacing: '0.02em',
        }}>
          &copy; {new Date().getFullYear()} VideoAI. Все права защищены.
        </div>
      </div>
    </footer>
  );
}
