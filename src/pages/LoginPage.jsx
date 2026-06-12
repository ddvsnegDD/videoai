import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { C } from '../lib/theme.js';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Btn from '../components/Btn.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => {
    const ssoErr = searchParams.get('error');
    if (ssoErr === 'csrf') return 'Ошибка безопасности. Попробуйте ещё раз.';
    if (ssoErr === 'token' || ssoErr === 'profile') return 'Не удалось войти через этот сервис. Попробуйте ещё раз.';
    if (ssoErr === 'server') return 'Ошибка сервера при входе. Попробуйте позже.';
    return '';
  });
  const [countdown, setCountdown] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const codeRefs = useRef([]);

  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef(null);
  const turnstileWidgetRef = useRef(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Fetch Turnstile site key from config
  useEffect(() => {
    api.get('/config').then(data => {
      if (data.turnstile_site_key) setTurnstileSiteKey(data.turnstile_site_key);
    }).catch(() => {});
  }, []);

  // Load Turnstile script & render widget on email step
  useEffect(() => {
    if (!turnstileSiteKey || step !== 'email') return;
    let cancelled = false;

    function renderWidget() {
      if (cancelled || !turnstileRef.current || !window.turnstile) return;
      turnstileWidgetRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: turnstileSiteKey,
        callback: (t) => setTurnstileToken(t),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        document.head.appendChild(s);
      }
      const iv = setInterval(() => {
        if (window.turnstile) { clearInterval(iv); renderWidget(); }
      }, 200);
      const timeout = setTimeout(() => clearInterval(iv), 10000);
      return () => { cancelled = true; clearInterval(iv); clearTimeout(timeout); cleanup(); };
    }

    function cleanup() {
      if (turnstileWidgetRef.current != null && window.turnstile) {
        try { window.turnstile.remove(turnstileWidgetRef.current); } catch {}
        turnstileWidgetRef.current = null;
      }
    }
    return () => { cancelled = true; cleanup(); };
  }, [turnstileSiteKey, step]);

  async function handleSendCode(e) {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Введите корректный email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/send-code', { email, turnstileToken: turnstileToken || undefined });
      setStep('code');
      setCountdown(60);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch (err) {
      if (err.data?.error === 'captcha_required' || err.data?.error === 'captcha_failed') {
        setError(err.data.message || 'Пройдите проверку безопасности.');
      } else if (err.data?.error === 'domain_blocked') {
        setError(err.data.message);
      } else if (err.data?.error === 'too_soon') {
        setError(`Подождите ${err.data.wait} сек перед повторной отправкой`);
      } else {
        setError('Ошибка отправки кода. Попробуйте позже.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(fullCode) {
    setLoading(true);
    setError('');
    try {
      await login(email, fullCode);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.data?.error === 'too_many_attempts') {
        setError('Слишком много попыток, запросите новый код');
        setStep('email');
      } else if (err.data?.error === 'invalid_code') {
        setError('Неверный или просроченный код');
      } else {
        setError('Ошибка проверки кода');
      }
      setCode(['', '', '', '', '', '']);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  }

  function handleCodeInput(index, value) {
    if (!/^\d*$/.test(value)) return;
    const next = [...code];
    next[index] = value.slice(-1);
    setCode(next);
    setError('');

    if (value && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }

    const full = next.join('');
    if (full.length === 6) {
      handleVerify(full);
    }
  }

  function handleCodeKeyDown(index, e) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  }

  function handleCodePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      const arr = pasted.split('');
      setCode(arr);
      handleVerify(pasted);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/send-code', { email });
      setCountdown(60);
    } catch {
      setError('Ошибка повторной отправки');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      background: C.bg,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 800,
            fontSize: '1.5rem',
            color: C.dark,
          }}>
            Video<span style={{ color: C.primary }}>AI</span>
          </span>
        </div>

        {/* Card */}
        <div style={{
          background: C.white,
          border: `1px solid ${C.gray200}`,
          borderRadius: 20,
          padding: '40px 32px',
          boxShadow: C.shadowMd,
        }}>
          {step === 'email' ? (
            <>
              <h1 style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: '1.5rem',
                fontWeight: 700,
                textAlign: 'center',
                color: C.dark,
                marginBottom: 8,
              }}>
                Войти в VideoAI
              </h1>
              <p style={{
                textAlign: 'center',
                color: C.gray500,
                fontSize: '0.9375rem',
                marginBottom: 32,
              }}>
                Введите email — мы отправим код
              </p>

              <form onSubmit={handleSendCode}>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Mail
                    size={18}
                    color={C.gray400}
                    style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    style={{ paddingLeft: 44 }}
                    autoFocus
                    autoComplete="email"
                  />
                </div>
                <p style={{
                  fontSize: '0.75rem',
                  color: C.gray400,
                  marginBottom: 16,
                  lineHeight: 1.4,
                }}>
                  Для новых аккаунтов разрешены российские почтовые сервисы (Яндекс, Mail.ru)
                </p>

                {error && (
                  <p style={{
                    color: C.danger,
                    fontSize: '0.8125rem',
                    marginBottom: 16,
                    textAlign: 'center',
                  }}>{error}</p>
                )}

                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  marginBottom: 20,
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  lineHeight: 1.5,
                  color: C.gray500,
                }}>
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                    style={{
                      width: 18,
                      height: 18,
                      marginTop: 1,
                      flexShrink: 0,
                      accentColor: C.primary,
                      cursor: 'pointer',
                    }}
                  />
                  <span>
                    Я принимаю условия{' '}
                    <a href="/oferta" target="_blank" rel="noopener noreferrer" style={{ color: C.primary, textDecoration: 'underline', textUnderlineOffset: 2 }}>Публичной оферты</a>
                    {' '}и даю согласие на обработку моих персональных данных в соответствии с{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.primary, textDecoration: 'underline', textUnderlineOffset: 2 }}>Политикой конфиденциальности</a>.
                  </span>
                </label>

                {turnstileSiteKey && (
                  <div ref={turnstileRef} style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }} />
                )}

                <Btn
                  variant="primary"
                  size="lg"
                  disabled={loading || !email || !agreed}
                  style={{ width: '100%' }}
                >
                  {loading ? (
                    <Loader2 size={18} style={{ animation: 'spin 0.7s linear infinite' }} />
                  ) : (
                    'Получить код'
                  )}
                </Btn>
              </form>

              {/* SSO divider */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                margin: '24px 0 20px',
              }}>
                <div style={{ flex: 1, height: 1, background: C.gray200 }} />
                <span style={{ fontSize: '0.8125rem', color: C.gray400, whiteSpace: 'nowrap' }}>или</span>
                <div style={{ flex: 1, height: 1, background: C.gray200 }} />
              </div>

              {/* SSO bonus hint */}
              <div style={{
                textAlign: 'center', padding: '10px 16px', borderRadius: 10,
                background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)',
                marginBottom: 12,
              }}>
                <span style={{ fontSize: '0.8125rem', color: C.primaryDark, fontWeight: 600 }}>
                  +50 кредитов за вход через Яндекс или VK
                </span>
              </div>

              {/* SSO buttons — gated by consent checkbox */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { href: '/api/auth/yandex', label: 'Войти через Яндекс', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#FC3F1D"/><path d="M13.32 7.2h-.93c-1.68 0-2.57.98-2.57 2.43 0 1.64.62 2.4 1.9 3.35l1.05.79-3.07 4.63h-2.2l2.78-4.11c-1.6-1.23-2.5-2.35-2.5-4.3 0-2.5 1.72-4.19 4.57-4.19h2.84v12.6h-1.87V7.2z" fill="#fff"/></svg> },
                  { href: '/api/auth/vk', label: 'Войти через ВКонтакте', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#0077FF"/><path d="M12.77 16.25h.73s.22-.02.33-.14c.1-.1.1-.31.1-.31s-.01-1.12.5-1.29c.5-.16 1.15 1.06 1.84 1.53.52.36.92.28.92.28l1.85-.03s.97-.06.51-.83c-.04-.06-.26-.58-1.33-1.63-1.12-1.1-.97-.92.38-2.82.82-1.16 1.15-1.86 1.05-2.16-.1-.29-.7-.21-.7-.21l-2.08.01s-.15-.02-.27.05c-.11.07-.18.24-.18.24s-.33.88-.76 1.63c-.92 1.58-1.29 1.66-1.44 1.56-.35-.24-.26-1.04-.26-1.6 0-1.72.26-2.44-.51-2.63-.26-.06-.44-.1-1.1-.11-.84-.01-1.55 0-1.95.2-.27.13-.47.43-.35.45.16.02.52.1.71.36.25.34.24 1.1.24 1.1s.14 2.03-.33 2.28c-.33.17-.78-.18-1.74-1.77-.44-.73-.77-1.53-.77-1.53s-.06-.16-.18-.24c-.14-.1-.34-.13-.34-.13l-1.97.01s-.3.01-.4.14c-.1.11-.01.35-.01.35s1.53 3.59 3.26 5.4c1.59 1.66 3.39 1.55 3.39 1.55z" fill="#fff"/></svg> },
                ].map(({ href, label, icon }) => (
                  <a
                    key={href}
                    href={agreed ? href : undefined}
                    onClick={e => { if (!agreed) e.preventDefault(); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      width: '100%', padding: '12px 16px', borderRadius: 12,
                      border: `1.5px solid ${C.gray200}`, background: C.white,
                      color: agreed ? C.dark : C.gray400, fontSize: '0.9375rem', fontWeight: 600,
                      textDecoration: 'none', cursor: agreed ? 'pointer' : 'not-allowed',
                      opacity: agreed ? 1 : 0.55,
                      transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s',
                      pointerEvents: agreed ? 'auto' : 'none',
                    }}
                    onMouseEnter={e => { if (agreed) { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(16,185,129,0.08)`; } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.gray200; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {icon}
                    {label}
                  </a>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep('email'); setCode(['', '', '', '', '', '']); setError(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: C.gray500,
                  fontSize: '0.8125rem',
                  padding: 0,
                  marginBottom: 24,
                }}
              >
                <ArrowLeft size={14} />
                Назад
              </button>

              <h1 style={{
                fontFamily: "'Manrope', sans-serif",
                fontSize: '1.5rem',
                fontWeight: 700,
                textAlign: 'center',
                color: C.dark,
                marginBottom: 8,
              }}>
                Введите код
              </h1>
              <p style={{
                textAlign: 'center',
                color: C.gray500,
                fontSize: '0.9375rem',
                marginBottom: 32,
              }}>
                Код отправлен на <span style={{ color: C.dark, fontWeight: 600 }}>{email}</span>
              </p>

              {/* 6-digit code inputs */}
              <div style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'center',
                marginBottom: 20,
              }}>
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => codeRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleCodeInput(i, e.target.value)}
                    onKeyDown={e => handleCodeKeyDown(i, e)}
                    onPaste={i === 0 ? handleCodePaste : undefined}
                    style={{
                      width: 48,
                      height: 56,
                      textAlign: 'center',
                      fontSize: '1.5rem',
                      fontFamily: "'Manrope', monospace",
                      fontWeight: 700,
                      color: C.dark,
                      background: C.gray100,
                      border: `1.5px solid ${digit ? C.primary : C.gray200}`,
                      borderRadius: 12,
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      caretColor: C.primary,
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = C.primary;
                      e.target.style.boxShadow = `0 0 0 4px rgba(16, 185, 129, 0.1)`;
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = digit ? C.primary : C.gray200;
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                ))}
              </div>

              {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  <Loader2 size={24} color={C.primary} style={{ animation: 'spin 0.7s linear infinite' }} />
                </div>
              )}

              {error && (
                <p style={{
                  color: C.danger,
                  fontSize: '0.8125rem',
                  marginBottom: 16,
                  textAlign: 'center',
                }}>{error}</p>
              )}

              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={handleResend}
                  disabled={countdown > 0 || loading}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: countdown > 0 ? 'default' : 'pointer',
                    color: countdown > 0 ? C.gray400 : C.primary,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    padding: 0,
                  }}
                >
                  {countdown > 0 ? `Отправить повторно (${countdown}с)` : 'Отправить код повторно'}
                </button>
              </div>
            </>
          )}
        </div>

        <p style={{
          textAlign: 'center',
          color: C.gray400,
          fontSize: '0.75rem',
          marginTop: 24,
          lineHeight: 1.5,
        }}>
          <a href="/oferta" target="_blank" rel="noopener noreferrer" style={{ color: C.gray400, textDecoration: 'underline' }}>Оферта</a>
          {' · '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.gray400, textDecoration: 'underline' }}>Конфиденциальность</a>
          {' · '}
          <a href="/consent" target="_blank" rel="noopener noreferrer" style={{ color: C.gray400, textDecoration: 'underline' }}>Согласие на обработку ПДн</a>
        </p>
      </div>
    </div>
  );
}
