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

      {/* Платёжные знаки + способы оплаты */}
      <div style={{
        maxWidth: 1280,
        margin: '24px auto 0',
        padding: '0 24px',
      }}>
        <img
          src={sbpCompactLight}
          alt="Система быстрых платежей (СБП)"
          height={26}
          style={{ height: 26, width: 'auto', display: 'block' }}
          loading="lazy"
          decoding="async"
        />
        <div style={{ fontSize: '0.8125rem', color: C.gray600, marginTop: 8 }}>
          Оплата картой, СБП, SberPay, T-Pay
        </div>
      </div>

      {/* Соцсети */}
      <div style={{
        maxWidth: 1280,
        margin: '20px auto 0',
        padding: '0 24px',
        display: 'flex',
        justifyContent: 'center',
        gap: 12,
      }}>
        <a href="https://t.me/ddvideoai" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: '#E3F2FD', color: '#039BE5', transition: 'opacity 0.15s' }} title="Telegram">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
        </a>
        <a href="https://vk.com/ddvideoai" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: '#E8EAF6', color: '#0077FF', transition: 'opacity 0.15s' }} title="ВКонтакте">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.77 16.25h.73s.22-.02.33-.14c.1-.1.1-.31.1-.31s-.01-1.12.5-1.29c.5-.16 1.15 1.06 1.84 1.53.52.36.92.28.92.28l1.85-.03s.97-.06.51-.83c-.04-.06-.26-.58-1.33-1.63-1.12-1.1-.97-.92.38-2.82.82-1.16 1.15-1.86 1.05-2.16-.1-.29-.7-.21-.7-.21l-2.08.01s-.15-.02-.27.05c-.11.07-.18.24-.18.24s-.33.88-.76 1.63c-.92 1.58-1.29 1.66-1.44 1.56-.35-.24-.26-1.04-.26-1.6 0-1.72.26-2.44-.51-2.63-.26-.06-.44-.1-1.1-.11-.84-.01-1.55 0-1.95.2-.27.13-.47.43-.35.45.16.02.52.1.71.36.25.34.24 1.1.24 1.1s.14 2.03-.33 2.28c-.33.17-.78-.18-1.74-1.77-.44-.73-.77-1.53-.77-1.53s-.06-.16-.18-.24c-.14-.1-.34-.13-.34-.13l-1.97.01s-.3.01-.4.14c-.1.11-.01.35-.01.35s1.53 3.59 3.26 5.4c1.59 1.66 3.39 1.55 3.39 1.55z"/></svg>
        </a>
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
  const credits = user?.credits ?? auth?.credits ?? 0;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // На лендинге и логине не показываем шапку кабинета
  const isGuestPage = pathname === '/' || pathname === '/login' || pathname === '/oferta' || pathname === '/privacy' || pathname === '/consent';

  const navItems = [
    { to: '/dashboard', label: 'Проекты' },
    { to: '/library', label: 'Библиотека' },
    { to: '/editor', label: 'Создать клип' },
    { to: '/assembly', label: 'Склеить' },
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
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => navigate('/account')}
                title={(() => {
                  const displayName = user?.name || user?.email || (user?.auth_provider === 'vk' ? 'Пользователь VK' : user?.auth_provider === 'yandex' ? 'Пользователь Яндекс' : 'Пользователь');
                  const via = user?.auth_provider === 'vk' ? 'Вход через VK' : user?.auth_provider === 'yandex' ? 'Вход через Яндекс' : user?.email || '';
                  return `${displayName}\n${via}\nЛичный кабинет`;
                })()}
                style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', overflow: 'hidden', padding: 0, background: user?.avatar_url ? 'transparent' : `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: '#fff', fontWeight: 700, fontSize: 14 }}
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', display: 'block' }} referrerPolicy="no-referrer" />
                ) : (
                  (user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()
                )}
              </button>
            </div>
          </div>
        </div>
      </header>
      <Outlet />
      <SiteFooter />
    </div>
  );
}
