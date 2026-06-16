// src/pages/BillingPage.jsx
// Sprint C merge: пакеты + оплата через ЮKassa
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, CreditCard, ShieldCheck, CheckCircle } from 'lucide-react';
import { C } from '../lib/theme';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PACKAGES } from '../data/tariffs';

export default function BillingPage() {
  const { user, refresh } = useAuth();
  const [searchParams] = useSearchParams();
  const [buying, setBuying] = useState(null);
  const [error, setError] = useState('');

  const [emailModal, setEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [pendingPkg, setPendingPkg] = useState(null);

  const justPaid = searchParams.get('paid') === '1';

  useEffect(() => {
    if (justPaid) refresh();
  }, []);

  async function proceedToPay(pkg) {
    setBuying(pkg.id);
    setError('');
    try {
      const res = await api.post('/payments/create', { packageId: pkg.id });
      if (res.paymentId) {
        localStorage.setItem('lastPaymentId', String(res.paymentId));
      }
      window.location.href = res.url;
    } catch (err) {
      setError(err.data?.error === 'payments_not_configured'
        ? 'Оплата временно недоступна'
        : 'Ошибка при создании платежа. Попробуйте ещё раз.');
      setBuying(null);
    }
  }

  async function handleBuy(pkg) {
    if (buying) return;
    if (!user?.email) {
      setPendingPkg(pkg);
      setEmailModal(true);
      setEmailInput('');
      setEmailError('');
      return;
    }
    proceedToPay(pkg);
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    const trimmed = emailInput.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setEmailError('Введите корректный email.');
      return;
    }
    setEmailSaving(true);
    setEmailError('');
    try {
      await api.post('/auth/set-email', { email: trimmed });
      await refresh();
      setEmailModal(false);
      if (pendingPkg) proceedToPay(pendingPkg);
    } catch (err) {
      const code = err.data?.error;
      if (code === 'domain_blocked') setEmailError(err.data?.message || 'Этот домен запрещён.');
      else if (code === 'email_taken') setEmailError('Этот email уже используется другим аккаунтом.');
      else setEmailError('Ошибка сохранения. Попробуйте ещё раз.');
    } finally {
      setEmailSaving(false);
    }
  }

  const glassCard = (isPopular) => ({
    background: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(20px)',
    border: isPopular ? `2px solid ${C.primary}` : '1px solid rgba(16, 185, 129, 0.12)',
    borderRadius: 24,
    padding: '32px 24px',
    boxShadow: isPopular ? '0 20px 40px rgba(10, 46, 31, 0.06)' : '0 12px 24px rgba(10, 46, 31, 0.02)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'transform 0.2s ease',
    transform: isPopular ? 'scale(1.03)' : 'scale(1)',
  });

  return (
    <div style={{ background: 'linear-gradient(135deg, #EFF6F0 0%, #EBF3F5 50%, #F3EBF5 100%)', minHeight: 'calc(100vh - 70px)', padding: '60px 20px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>

        {/* Paid success banner */}
        {justPaid && (
          <div style={{
            background: C.primaryLight, border: `1px solid ${C.primary}30`,
            borderRadius: 16, padding: '16px 20px', marginBottom: 28,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <CheckCircle size={20} color={C.primary} style={{ flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 600, color: C.primaryDark, fontSize: 15 }}>Платёж принят</p>
              <p style={{ color: C.gray500, fontSize: 13 }}>Кредиты появятся в течение минуты — обновите страницу если не отображаются.</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 36, fontWeight: 800, color: C.dark, marginBottom: 12 }}>
            Выберите пакет видеокреативов
          </h1>
          <p style={{ fontSize: 16, color: C.gray600, maxWidth: 600, margin: '0 auto', lineHeight: 1.5 }}>
            Покупайте готовые ролики для маркетплейсов. Безопасная оплата картой или через СБП, кредиты не сгорают и остаются на балансе навсегда.
          </p>
          <p style={{ color: C.gray400, fontSize: 14, marginTop: 8 }}>
            Ваш баланс: <strong style={{ color: C.primary }}>{user?.credits ?? 0} кредитов</strong>
          </p>
        </div>

        {error && (
          <p style={{ color: C.danger, fontSize: 14, marginBottom: 16, background: '#FEE2E2', borderRadius: 10, padding: '10px 16px', textAlign: 'center' }}>
            {error}
          </p>
        )}

        {/* Packages grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30, alignItems: 'stretch', marginBottom: 50, textAlign: 'left' }}>
          {PACKAGES.map(pkg => {
            const pop = !!pkg.popular;
            const isLoading = buying === pkg.id;
            const anyBuying = !!buying;

            return (
              <div key={pkg.id} style={glassCard(pop)}>
                {pop && (
                  <div style={{
                    position: 'absolute', top: -12, right: 24,
                    backgroundColor: C.primary, color: '#FFFFFF',
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    boxShadow: '0 4px 10px rgba(16,185,129,0.2)',
                  }}>ПОПУЛЯРНО</div>
                )}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: pop ? C.primaryDark : C.gray600, marginBottom: 8 }}>{pkg.title}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: C.dark }}>{pkg.price.toLocaleString('ru-RU')} ₽</span>
                  </div>
                  <p style={{ fontSize: 12, color: C.primary, fontWeight: 600, marginBottom: 20 }}>
                    {pkg.credits} кредитов
                  </p>
                  <p style={{ fontSize: 13, color: C.gray500, lineHeight: 1.4, marginBottom: 24 }}>{pkg.subtitle}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: `1px solid ${C.gray200}`, paddingTop: 20 }}>
                    {pkg.feats.map((f, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, fontSize: 14, alignItems: 'center' }}>
                        <Check size={16} style={{ color: C.primary, flexShrink: 0 }} />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  disabled={anyBuying}
                  onClick={() => handleBuy(pkg)}
                  style={{
                    width: '100%',
                    border: pop ? 'none' : `1px solid ${C.primary}`,
                    color: pop ? '#FFFFFF' : C.primary,
                    backgroundColor: pop ? C.primary : 'transparent',
                    padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 600,
                    marginTop: 32, cursor: anyBuying ? 'default' : 'pointer',
                    boxShadow: pop ? '0 8px 20px rgba(16,185,129,0.15)' : 'none',
                    opacity: anyBuying ? 0.6 : 1,
                  }}
                >
                  {isLoading ? 'Открываем оплату...' : (pop ? 'Оплатить пакет' : 'Купить пакет')}
                </button>
              </div>
            );
          })}
        </div>

        {/* Trust badges */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 760, margin: '0 auto 50px', textAlign: 'left' }}>
          <div style={{ display: 'flex', gap: 12, background: 'rgba(255,255,255,0.4)', padding: 16, borderRadius: 14, border: '1px solid rgba(0,0,0,0.03)' }}>
            <CreditCard style={{ color: C.primary, flexShrink: 0 }} size={20} />
            <div style={{ fontSize: 13, lineHeight: 1.4, color: C.gray600 }}>
              <strong>Безопасная оплата.</strong> Все платежи шифруются через ЮKassa. Мы не храним данные ваших банковских карт. Карты, СБП, электронные кошельки.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, background: 'rgba(255,255,255,0.4)', padding: 16, borderRadius: 14, border: '1px solid rgba(0,0,0,0.03)' }}>
            <ShieldCheck style={{ color: C.primary, flexShrink: 0 }} size={20} />
            <div style={{ fontSize: 13, lineHeight: 1.4, color: C.gray600 }}>
              <strong>Кредиты не сгорают.</strong> Купленные кредиты остаются на вашем балансе без ограничения по времени.
            </div>
          </div>
        </div>

        <p style={{ color: C.gray300, fontSize: 12, marginTop: 40, lineHeight: 1.5, textAlign: 'center' }}>
          Оплата через ЮKassa. Кредиты начисляются автоматически после подтверждения платежа. Не является публичной офертой.
        </p>
      </div>

      {emailModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center',
        }} onClick={() => { if (!emailSaving) { setEmailModal(false); setPendingPkg(null); } }}>
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleEmailSubmit}
            style={{
              background: '#fff', borderRadius: 20, padding: '32px 28px', width: 400, maxWidth: '90vw',
              boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 18, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
              Укажите email
            </h3>
            <p style={{ fontSize: 14, color: C.gray500, marginBottom: 20, lineHeight: 1.4 }}>
              На него придёт чек об оплате. Вы также сможете входить по email.
            </p>
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              disabled={emailSaving}
              style={{
                width: '100%', padding: '12px 14px', fontSize: 15, borderRadius: 10,
                border: `1.5px solid ${emailError ? C.danger : C.gray200}`,
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { if (!emailError) e.target.style.borderColor = C.primary; }}
              onBlur={e => { if (!emailError) e.target.style.borderColor = C.gray200; }}
            />
            {emailError && (
              <p style={{ color: C.danger, fontSize: 13, marginTop: 8 }}>{emailError}</p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                disabled={emailSaving}
                onClick={() => { setEmailModal(false); setPendingPkg(null); }}
                style={{
                  flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${C.gray200}`,
                  background: '#fff', color: C.gray600, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={emailSaving}
                style={{
                  flex: 1, padding: 12, borderRadius: 10, border: 'none',
                  background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: emailSaving ? 'default' : 'pointer', opacity: emailSaving ? 0.7 : 1,
                }}
              >
                {emailSaving ? 'Сохраняем...' : 'Продолжить'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
