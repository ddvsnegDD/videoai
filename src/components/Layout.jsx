// src/components/Layout.jsx
import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, Shield } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { isAdmin } from '../lib/adminConfig';
import { C } from '../lib/theme';
import sbpCompactLight from '../assets/sbp/sbp-compact-light.png';

function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer style={{
      borderTop: `1px solid ${C.gray200}`,
      background: 'rgba(248,250,249,0.92)',
      padding: '36px 24px 32px',
      fontSize: '0.8125rem',
      color: C.gray500,
      lineHeight: 1.6,
    }}>
      <div style={{
        maxWidth: 1280,
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '28px 48px',
        justifyContent: 'space-between',
      }}>
        {/* Бренд + копирайт */}
        <div style={{ minWidth: 180 }}>
          <div style={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 800,
            fontSize: '1.1rem',
            color: C.dark,
            marginBottom: 8,
          }}>
            Video<span style={{ color: C.primary }}>AI</span>
          </div>
          <div>&copy; {year} VideoAI</div>
        </div>

        {/* Реквизиты */}
        <div style={{ minWidth: 220 }}>
          <div style={{ fontWeight: 600, color: C.gray600, marginBottom: 6 }}>Реквизиты</div>
          <div>Дзыга Дмитрий Владиславович</div>
          <div>Самозанятый (плательщик НПД)</div>
          <div>ИНН: 505004685439</div>
          <div>Email: ddv1121@yandex.ru</div>
        </div>

        {/* Документы */}
        <div style={{ minWidth: 200 }}>
          <div style={{ fontWeight: 600, color: C.gray600, marginBottom: 6 }}>Документы</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Link to="/oferta" style={{ color: C.gray500, textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = C.primary}
              onMouseLeave={e => e.currentTarget.style.color = C.gray500}
            >Публичная оферта</Link>
            <Link to="/privacy" style={{ color: C.gray500, textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = C.primary}
              onMouseLeave={e => e.currentTarget.style.color = C.gray500}
            >Политика конфиденциальности</Link>
            <Link to="/consent" style={{ color: C.gray500, textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = C.primary}
              onMouseLeave={e => e.currentTarget.style.color = C.gray500}
            >Согласие на обработку ПДн</Link>
          </div>
        </div>
      </div>

      {/* Платёжные знаки — единая высота --mark-h, gap ≥ 20px (НСПК) */}
      <div style={{
        maxWidth: 1280,
        margin: '24px auto 0',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
      }}>
        <img
          src={sbpCompactLight}
          alt="Система быстрых платежей (СБП)"
          height={26}
          style={{ height: 26, width: 'auto', display: 'block' }}
          loading="lazy"
          decoding="async"
        />
      </div>
    </footer>
  );
}

/**
 * Сквозной контейнер: липкая шапка (лого, навигация, баланс, аватар)
 * + <Outlet/> для страниц. На гостевых страницах (/, /login) шапка кабинета
 * скрыта — там свой хедер внутри HomePage.
 */
export default function Layout() {
  // У тебя useAuth() возвращает как минимум { user }. Баланс и выход берём
  // безопасно: если их нет — UI не сломается.
  const auth = useAuth();
  const user = auth?.user;
  const logout = auth?.logout;
  const credits = user?.credits ?? auth?.credits ?? 0;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // На лендинге и логине не показываем шапку кабинета
  const isGuestPage = pathname === '/' || pathname === '/login' || pathname === '/oferta' || pathname === '/privacy' || pathname === '/consent';

  const navItems = [
    { to: '/dashboard', label: 'Проекты' },
    { to: '/library', label: 'Библиотека' },
    { to: '/editor', label: 'Создать клип' },
    { to: '/billing', label: 'Тарифы' },
  ];
  if (isAdmin(user)) navItems.push({ to: '/admin', label: 'Админ', icon: Shield });

  const pageBg = {
    minHeight: '100vh',
    background: 'linear-gradient(150deg, #EFF6F0 0%, #EBF3F5 48%, #F3EBF5 100%)',
    backgroundAttachment: 'fixed',
  };

  if (isGuestPage) {
    return (
      <div style={pageBg}>
        <Outlet />
        <SiteFooter />
      </div>
    );
  }

  return (
    <div style={pageBg}>
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(247,250,248,0.82)', backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${C.gray200}`,
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 66, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, display: 'grid', placeItems: 'center', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                <span style={{ color: '#fff', fontSize: 13, marginLeft: 2 }}>▶</span>
              </div>
              <span style={{ fontFamily: '"Manrope", sans-serif', fontWeight: 800, fontSize: 18, color: C.dark, letterSpacing: '-0.02em' }}>VideoAI</span>
            </Link>
            <nav style={{ display: 'flex', gap: 6 }}>
              {navItems.map(({ to, label, icon: Icon }) => {
                const active = pathname === to;
                return (
                  <Link key={to} to={to} style={{
                    display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                    background: active ? '#fff' : 'transparent', color: active ? C.dark : C.gray600,
                    padding: '8px 14px', borderRadius: 9, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
                    boxShadow: active ? '0 2px 8px rgba(10,46,31,0.07)' : 'none',
                  }}>
                    {Icon && <Icon size={14} />}{label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <button onClick={() => navigate('/billing')} style={{
              display: 'flex', alignItems: 'center', gap: 7, background: C.primaryLight, color: C.primaryDark,
              border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: 100, fontSize: 13.5, fontWeight: 700,
            }}>
              <Sparkles size={14} /> {credits ?? 0} кредитов
            </button>
            <button
              onClick={() => logout && logout()}
              title="Выйти"
              style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: '#fff', fontWeight: 700, fontSize: 14 }}
            >
              {(user?.email?.[0] || 'U').toUpperCase()}
            </button>
          </div>
        </div>
      </header>
      <Outlet />
      <SiteFooter />
    </div>
  );
}
