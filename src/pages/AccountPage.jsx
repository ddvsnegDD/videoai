import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { C } from '../lib/theme';
import { LogOut, Mail, User, Sparkles, Zap, Link2, Unlink, ShieldCheck, Receipt, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { PACKAGES } from '../data/tariffs';

const YANDEX_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#FC3F1D"/>
    <path d="M13.32 7.2h-.93c-1.68 0-2.57.98-2.57 2.43 0 1.64.62 2.4 1.9 3.35l1.05.79-3.07 4.63h-2.2l2.78-4.11c-1.6-1.23-2.5-2.35-2.5-4.3 0-2.5 1.72-4.19 4.57-4.19h2.84v12.6h-1.87V7.2z" fill="#fff"/>
  </svg>
);

const VK_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#0077FF"/>
    <path d="M12.77 16.25h.73s.22-.02.33-.14c.1-.1.1-.31.1-.31s-.01-1.12.5-1.29c.5-.16 1.15 1.06 1.84 1.53.52.36.92.28.92.28l1.85-.03s.97-.06.51-.83c-.04-.06-.26-.58-1.33-1.63-1.12-1.1-.97-.92.38-2.82.82-1.16 1.15-1.86 1.05-2.16-.1-.29-.7-.21-.7-.21l-2.08.01s-.15-.02-.27.05c-.11.07-.18.24-.18.24s-.33.88-.76 1.63c-.92 1.58-1.29 1.66-1.44 1.56-.35-.24-.26-1.04-.26-1.6 0-1.72.26-2.44-.51-2.63-.26-.06-.44-.1-1.1-.11-.84-.01-1.55 0-1.95.2-.27.13-.47.43-.35.45.16.02.52.1.71.36.25.34.24 1.1.24 1.1s.14 2.03-.33 2.28c-.33.17-.78-.18-1.74-1.77-.44-.73-.77-1.53-.77-1.53s-.06-.16-.18-.24c-.14-.1-.34-.13-.34-.13l-1.97.01s-.3.01-.4.14c-.1.11-.01.35-.01.35s1.53 3.59 3.26 5.4c1.59 1.66 3.39 1.55 3.39 1.55z" fill="#fff"/>
  </svg>
);

const STATUS_MAP = {
  pending: { label: 'Ожидает', icon: Clock, color: C.gray400 },
  completed: { label: 'Оплачен', icon: CheckCircle, color: C.primary },
  canceled: { label: 'Отменён', icon: AlertCircle, color: C.gray400 },
  mismatch: { label: 'Ошибка суммы', icon: AlertCircle, color: C.danger },
};

const PROVIDER_META = {
  yandex: { label: 'Яндекс ID', icon: YANDEX_ICON, color: '#FC3F1D' },
  vk: { label: 'VK ID', icon: VK_ICON, color: '#0077FF' },
};

export default function AccountPage() {
  const { user, logout, refresh } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [nameVal, setNameVal] = useState(user?.name || '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState('');

  const [emailStep, setEmailStep] = useState('idle');
  const [newEmail, setNewEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');

  const [unlinking, setUnlinking] = useState(null); // provider being unlinked
  const [linkMsg, setLinkMsg] = useState(''); // success/error message
  const [linkMsgType, setLinkMsgType] = useState('success'); // 'success' | 'error'

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Handle link/unlink query params from OAuth redirect
  useEffect(() => {
    const linked = searchParams.get('linked');
    const linkError = searchParams.get('link_error');

    if (linked) {
      const meta = PROVIDER_META[linked];
      setLinkMsg(`${meta?.label || linked} успешно привязан`);
      setLinkMsgType('success');
      searchParams.delete('linked');
      setSearchParams(searchParams, { replace: true });
      refresh();
      setTimeout(() => setLinkMsg(''), 5000);
    } else if (linkError) {
      const messages = {
        conflict: 'Этот аккаунт уже привязан к другому пользователю',
        auth: 'Необходимо войти в аккаунт',
        csrf: 'Ошибка безопасности. Попробуйте ещё раз',
        server: 'Ошибка сервера. Попробуйте позже',
        token: 'Ошибка авторизации у провайдера',
        profile: 'Не удалось получить данные профиля',
      };
      setLinkMsg(messages[linkError] || 'Ошибка привязки');
      setLinkMsgType('error');
      searchParams.delete('link_error');
      setSearchParams(searchParams, { replace: true });
      setTimeout(() => setLinkMsg(''), 7000);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get('/payments/history')
      .then(d => setHistory(d.payments || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  // Identities from server
  const identities = user?.identities || [];
  const yandexIdentity = identities.find(i => i.provider === 'yandex');
  const vkIdentity = identities.find(i => i.provider === 'vk');

  const displayName = user?.name || user?.email || (vkIdentity ? 'Пользователь VK' : yandexIdentity ? 'Пользователь Яндекс' : 'Пользователь');
  const avatarLetter = (user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase();

  // Count login methods for unlink protection
  const hasEmail = !!user?.email;
  const totalMethods = (hasEmail ? 1 : 0) + identities.length;
  const canUnlink = totalMethods > 1;

  // Build login method description
  const loginMethods = [];
  if (hasEmail) loginMethods.push('Email');
  if (yandexIdentity) loginMethods.push('Яндекс');
  if (vkIdentity) loginMethods.push('VK');
  const loginMethod = loginMethods.length > 0 ? loginMethods.join(' + ') : 'Не настроен';

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

  async function handleUnlink(provider) {
    if (!canUnlink) return;
    setUnlinking(provider);
    setLinkMsg('');
    try {
      await api.del(`/account/unlink/${provider}`);
      await refresh();
      const meta = PROVIDER_META[provider];
      setLinkMsg(`${meta?.label || provider} отвязан`);
      setLinkMsgType('success');
      setTimeout(() => setLinkMsg(''), 4000);
    } catch (err) {
      const msg = err.data?.message || err.data?.error || 'Ошибка отвязки';
      setLinkMsg(msg);
      setLinkMsgType('error');
      setTimeout(() => setLinkMsg(''), 5000);
    } finally {
      setUnlinking(null);
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

      {/* Способы входа */}
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 16 }}>
          <ShieldCheck size={16} style={{ marginRight: 6, verticalAlign: -3 }} />Способы входа
        </div>

        {linkMsg && (
          <div style={{
            fontSize: 13, padding: '10px 14px', borderRadius: 10, marginBottom: 14,
            background: linkMsgType === 'success' ? '#D1FAE5' : '#FEE2E2',
            color: linkMsgType === 'success' ? '#065F46' : '#991B1B',
            fontWeight: 500,
          }}>
            {linkMsg}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Email row */}
          <IdentityRow
            icon={<Mail size={18} color={C.primary} />}
            label="Email"
            linked={hasEmail}
            detail={user?.email || null}
            canUnlink={false}
          />

          {/* Yandex row */}
          <IdentityRow
            icon={YANDEX_ICON}
            label="Яндекс ID"
            linked={!!yandexIdentity}
            detail={yandexIdentity?.provider_email || yandexIdentity?.provider_name || null}
            canUnlink={canUnlink}
            unlinking={unlinking === 'yandex'}
            onLink={() => { window.location.href = '/api/auth/yandex?link=1'; }}
            onUnlink={() => handleUnlink('yandex')}
          />

          {/* VK row */}
          <IdentityRow
            icon={VK_ICON}
            label="VK ID"
            linked={!!vkIdentity}
            detail={vkIdentity?.provider_email || vkIdentity?.provider_name || null}
            canUnlink={canUnlink}
            unlinking={unlinking === 'vk'}
            onLink={() => { window.location.href = '/api/auth/vk?link=1'; }}
            onUnlink={() => handleUnlink('vk')}
          />
        </div>

        {!canUnlink && identities.length > 0 && (
          <p style={{ fontSize: 12, color: C.gray400, marginTop: 12, lineHeight: 1.4 }}>
            Добавьте email или ещё один способ входа, чтобы отвязать текущий.
          </p>
        )}
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

      {/* Payment history */}
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 16 }}>
          <Receipt size={16} style={{ marginRight: 6, verticalAlign: -3 }} />История платежей
        </div>
        {historyLoading ? (
          <div className="spinner" style={{ margin: '24px auto' }} />
        ) : history.length === 0 ? (
          <p style={{ color: C.gray400, fontSize: 14 }}>Платежей пока нет.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(p => <PaymentRow key={p.id} payment={p} />)}
          </div>
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

function PaymentRow({ payment }) {
  const statusInfo = STATUS_MAP[payment.status] || STATUS_MAP.pending;
  const StatusIcon = statusInfo.icon;
  const pkg = PACKAGES.find(p => p.id === payment.package_id);
  const date = new Date(payment.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div style={{
      background: '#fff', border: `1px solid ${C.gray200}`, borderRadius: 12,
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      <StatusIcon size={16} color={statusInfo.color} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 120 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>
          {pkg?.title || payment.package_id}
        </p>
        <p style={{ color: C.gray400, fontSize: 12 }}>{date}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>
          {payment.paid_amount ?? payment.expected_amount} ₽
        </p>
        {payment.credits_granted && (
          <p style={{ color: C.primary, fontSize: 12, fontWeight: 600 }}>
            +{payment.credits_granted} кр.
          </p>
        )}
      </div>
      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: `${statusInfo.color}20`, color: statusInfo.color, fontWeight: 600 }}>
        {statusInfo.label}
      </span>
    </div>
  );
}

/** Row component for each login method in "Способы входа" */
function IdentityRow({ icon, label, linked, detail, canUnlink, unlinking, onLink, onUnlink }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 12,
      background: linked ? '#F0FDF4' : C.gray100,
      border: `1px solid ${linked ? '#BBF7D0' : C.gray200}`,
    }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>{label}</div>
        {linked && detail && (
          <div style={{ fontSize: 12, color: C.gray500, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {detail}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        {linked ? (
          onUnlink ? (
            <button
              onClick={onUnlink}
              disabled={!canUnlink || unlinking}
              title={!canUnlink ? 'Нельзя отвязать единственный способ входа' : 'Отвязать'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1px solid ${canUnlink ? '#FECACA' : C.gray200}`,
                background: canUnlink ? '#FEF2F2' : C.gray100,
                color: canUnlink ? '#991B1B' : C.gray400,
                cursor: canUnlink && !unlinking ? 'pointer' : 'not-allowed',
                opacity: unlinking ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
            >
              <Unlink size={12} />
              {unlinking ? 'Отвязка...' : 'Отвязать'}
            </button>
          ) : (
            <span style={{
              fontSize: 12, fontWeight: 600, color: '#065F46', padding: '4px 10px',
              background: '#D1FAE5', borderRadius: 6,
            }}>
              Привязан
            </span>
          )
        ) : (
          onLink && (
            <button
              onClick={onLink}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1px solid ${C.gray200}`,
                background: '#fff', color: C.primaryDark,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.primaryLight; e.currentTarget.style.borderColor = C.primary; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = C.gray200; }}
            >
              <Link2 size={12} />
              Привязать
            </button>
          )
        )}
      </div>
    </div>
  );
}
