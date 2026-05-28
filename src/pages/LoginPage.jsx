import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { C } from '../lib/theme.js';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Btn from '../components/Btn.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const codeRefs = useRef([]);

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

  async function handleSendCode(e) {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Введите корректный email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/send-code', { email });
      setStep('code');
      setCountdown(60);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch (err) {
      if (err.data?.error === 'too_soon') {
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
                <div style={{ position: 'relative', marginBottom: 20 }}>
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

                {error && (
                  <p style={{
                    color: C.danger,
                    fontSize: '0.8125rem',
                    marginBottom: 16,
                    textAlign: 'center',
                  }}>{error}</p>
                )}

                <Btn
                  variant="primary"
                  size="lg"
                  disabled={loading || !email}
                  style={{ width: '100%' }}
                >
                  {loading ? (
                    <Loader2 size={18} style={{ animation: 'spin 0.7s linear infinite' }} />
                  ) : (
                    'Получить код'
                  )}
                </Btn>
              </form>
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
          Продолжая, вы соглашаетесь с условиями использования сервиса
        </p>
      </div>
    </div>
  );
}
