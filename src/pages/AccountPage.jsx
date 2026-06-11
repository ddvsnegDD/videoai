import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { C } from '../lib/theme';
import { LogOut, Mail, User, Sparkles, Zap } from 'lucide-react';

export default function AccountPage() {
  const { user, logout, refresh } = useAuth();

  const [nameVal, setNameVal] = useState(user?.name || '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState('');

  const [emailStep, setEmailStep] = useState('idle');
  const [newEmail, setNewEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');

  const displayName = user?.name || user?.email || (user?.auth_provider === 'vk' ? 'Пользователь VK' : user?.auth_provider === 'yandex' ? 'Пользователь Яндекс' : 'Пользователь');
  const loginMethod = user?.auth_provider === 'vk' ? 'Вход через VK' : user?.auth_provider === 'yandex' ? 'Вход через Яндекс' : 'Вход по email';
  const avatarLetter = (user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase();

  async function handleNameSave() {
    setNameSaving(true);
    setNameMsg('');
    try {
      await api.post('/account/name', { name: nameVal });
      await refresh();
      setNameMsg('Сохранено');
      setTimeout(() => setNameMsg(''), 2000);
    } catch {
      setNameMsg('Ошибка сохранения');
    } finally {
      setNameSaving(false);
    }
  }

  async function handleEmailRequestCode(e) {
    e.preventDefault();
    const trimmed = newEmail.trim();
    if (!trimmed || !trimmed.includes('@')) { setEmailError('Введите корректный email.'); return; }
    setEmailSaving(true);
    setEmailError('');
    setEmailSuccess('');
    try {
      await api.post('/account/email/request-code', { newEmail: trimmed });
      setEmailStep('code');
    } catch (err) {
      const code = err.data?.error;
      if (code === 'domain_blocked') setEmailError(err.data?.message || 'Этот домен запрещён.');
      else if (code === 'email_taken') setEmailError('Этот email уже используется другим аккаунтом.');
      else if (code === 'too_soon') setEmailError('Подождите минуту перед повторной отправкой.');
      else setEmailError('Ошибка отправки кода. Попробуйте ещё раз.');
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleEmailConfirm(e) {
    e.preventDefault();
    if (!otpCode.trim()) { setEmailError('Введите код.'); return; }
    if (emailSaving) return;
    setEmailSaving(true);
    setEmailError('');
    setEmailSuccess('');
    try {
      await api.post('/account/email/confirm', { newEmail: newEmail.trim(), code: otpCode.trim() });
      const savedEmail = newEmail.trim().toLowerCase();
      setEmailStep('idle');
      setNewEmail('');
      setOtpCode('');
      setEmailSaving(false);
      setEmailSuccess(`Email изменён на ${savedEmail}`);
      setTimeout(() => setEmailSuccess(''), 5000);
      try { await refresh(); } catch {}
    } catch (err) {
      const code = err.data?.error;
      if (code === 'invalid_code') setEmailError('Неверный код. Попробуйте ещё раз.');
      else if (code === 'too_many_attempts') setEmailError('Слишком много попыток. Запросите новый код.');
      else if (code === 'email_taken') setEmailError('Этот email уже используется другим аккаунтом.');
      else setEmailError('Ошибка подтверждения.');
      setEmailSaving(false);
    }
  }

  const card = {
    background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)',
    border: `1px solid ${C.gray200}`, borderRadius: 20,
    padding: '28px 24px', marginBottom: 20,
  };
  const label = { fontSize: 13, color: C.gray500, marginBottom: 4, fontWeight: 600 };
  const value = { fontSize: 15, color: C.dark, fontWeight: 500 };
  const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: 15, borderRadius: 10,
    border: `1.5px solid ${C.gray200}`, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };
  const btnPrimary = {
    padding: '10px 20px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  };
  const btnSecondary = {
    padding: '10px 20px', borderRadius: 10, border: `1px solid ${C.gray200}`,
    background: '#fff', color: C.gray600, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 20px 80px' }}>
      <h1 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 28, fontWeight: 800, color: C.dark, marginBottom: 32 }}>
        Личный кабинет
      </h1>

      {/* Profile card */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
            background: user?.avatar_url ? 'transparent' : `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
            display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 22,
          }}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', display: 'block' }} referrerPolicy="no-referrer" />
            ) : avatarLetter}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.dark }}>{displayName}</div>
            <div style={{ fontSize: 13, color: C.gray500, marginTop: 2 }}>{loginMethod}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={label}><Mail size={13} style={{ marginRight: 4, verticalAlign: -2 }} />Email</div>
            {user?.email ? (
              <div style={value}>{user.email}</div>
            ) : (
              <div style={{ ...value, color: C.gray400, fontStyle: 'italic' }}>Не указан</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={label}><Sparkles size={13} style={{ marginRight: 4, verticalAlign: -2 }} />Кредиты</div>
              <div style={value}>{user?.credits ?? 0}</div>
            </div>
            {(user?.free_wan > 0 || user?.free_veo > 0 || user?.free_image > 0) && (
              <div>
                <div style={label}><Zap size={13} style={{ marginRight: 4, verticalAlign: -2 }} />Пробные попытки</div>
                <div style={{ fontSize: 13, color: C.gray600, lineHeight: 1.6 }}>
                  {user?.free_wan > 0 && <div>Kling: {user.free_wan}</div>}
                  {user?.free_veo > 0 && <div>Veo: {user.free_veo}</div>}
                  {user?.free_image > 0 && <div>Картинка: {user.free_image}</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit name */}
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 14 }}>
          <User size={16} style={{ marginRight: 6, verticalAlign: -3 }} />Имя
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="text"
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            placeholder="Ваше имя"
            maxLength={80}
            style={{ ...inputStyle, flex: 1 }}
            onFocus={e => e.target.style.borderColor = C.primary}
            onBlur={e => e.target.style.borderColor = C.gray200}
          />
          <button
            onClick={handleNameSave}
            disabled={nameSaving}
            style={{ ...btnPrimary, opacity: nameSaving ? 0.7 : 1, whiteSpace: 'nowrap' }}
          >
            {nameSaving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
        {nameMsg && (
          <div style={{ fontSize: 13, marginTop: 8, color: nameMsg === 'Сохранено' ? C.primary : C.danger }}>
            {nameMsg}
          </div>
        )}
      </div>

      {/* Edit email */}
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 6 }}>
          <Mail size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
          {user?.email ? 'Сменить email' : 'Добавить email'}
        </div>
        <p style={{ fontSize: 13, color: C.gray500, marginBottom: 14, lineHeight: 1.4 }}>
          {user?.email
            ? 'На новый адрес будет отправлен код подтверждения.'
            : 'Укажите email — на него будут приходить чеки и через него можно будет входить.'}
        </p>

        {emailStep === 'idle' && (
          <form onSubmit={handleEmailRequestCode} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="email"
              value={newEmail}
              onChange={e => { setNewEmail(e.target.value); setEmailError(''); }}
              placeholder="you@example.com"
              style={{ ...inputStyle, flex: 1, borderColor: emailError ? C.danger : C.gray200 }}
              onFocus={e => { if (!emailError) e.target.style.borderColor = C.primary; }}
              onBlur={e => { if (!emailError) e.target.style.borderColor = C.gray200; }}
            />
            <button type="submit" disabled={emailSaving} style={{ ...btnPrimary, opacity: emailSaving ? 0.7 : 1, whiteSpace: 'nowrap' }}>
              {emailSaving ? 'Отправка...' : 'Получить код'}
            </button>
          </form>
        )}

        {emailStep === 'code' && (
          <form onSubmit={handleEmailConfirm}>
            <p style={{ fontSize: 14, color: C.dark, marginBottom: 12 }}>
              Код отправлен на <strong>{newEmail.trim()}</strong>
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                value={otpCode}
                onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setEmailError(''); }}
                placeholder="6-значный код"
                maxLength={6}
                autoFocus
                style={{ ...inputStyle, flex: 1, borderColor: emailError ? C.danger : C.gray200 }}
                onFocus={e => { if (!emailError) e.target.style.borderColor = C.primary; }}
                onBlur={e => { if (!emailError) e.target.style.borderColor = C.gray200; }}
              />
              <button type="submit" disabled={emailSaving} style={{ ...btnPrimary, opacity: emailSaving ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                {emailSaving ? 'Проверка...' : 'Подтвердить'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setEmailStep('idle'); setOtpCode(''); setEmailError(''); }}
              style={{ ...btnSecondary, marginTop: 10, padding: '8px 16px', fontSize: 13 }}
            >
              Назад
            </button>
          </form>
        )}

        {emailError && (
          <div style={{ fontSize: 13, marginTop: 8, color: C.danger }}>{emailError}</div>
        )}
        {emailSuccess && (
          <div style={{ fontSize: 13, marginTop: 8, color: C.primary, fontWeight: 600 }}>{emailSuccess}</div>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={() => logout && logout()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 600,
          border: `1.5px solid ${C.danger}`, background: '#fff', color: C.danger,
          cursor: 'pointer', transition: 'background 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = C.dangerLight; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
      >
        <LogOut size={18} /> Выйти из аккаунта
      </button>
    </div>
  );
}
