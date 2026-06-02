import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Zap, Crown, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { C } from '../lib/theme.js';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { PACKAGES } from '../data/tariffs.js';
import Btn from '../components/Btn.jsx';

const TABS = [
  {
    key: 'economy',
    label: 'Эконом (Kling)',
    icon: Zap,
    accentColor: C.primary,
    lightColor: C.primaryLight,
    darkColor: C.primaryDark,
    hint: 'Быстро и доступно — для массовых креативов',
  },
  {
    key: 'premium',
    label: 'Премиум (Veo)',
    icon: Crown,
    accentColor: '#8B5CF6',
    lightColor: '#EDE9FE',
    darkColor: '#6D28D9',
    hint: 'Кинематографичное качество',
  },
];

const STATUS_MAP = {
  pending: { label: 'Ожидает', icon: Clock, color: C.gray400 },
  completed: { label: 'Оплачен', icon: CheckCircle, color: C.primary },
  mismatch: { label: 'Ошибка суммы', icon: AlertCircle, color: C.danger },
};

export default function BillingPage() {
  const { user, refresh } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [buying, setBuying] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const justPaid = searchParams.get('paid') === '1';
  const kindParam = searchParams.get('kind');
  const activeTab = TABS.find(t => t.key === kindParam) ? kindParam : 'economy';

  useEffect(() => {
    if (justPaid) refresh();
    api.get('/payments/history')
      .then(d => setHistory(d.payments || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  function switchTab(key) {
    setError('');
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('kind', key);
      return next;
    });
  }

  async function handleBuy(pkg) {
    if (buying) return;
    setBuying(pkg.id);
    setError('');
    try {
      const res = await api.post('/payments/create', { packageId: pkg.id });
      window.location.href = res.url;
    } catch (err) {
      setError(err.data?.error === 'payments_not_configured'
        ? 'Оплата временно недоступна'
        : 'Ошибка при создании платежа. Попробуйте ещё раз.');
      setBuying(null);
    }
  }

  const tab = TABS.find(t => t.key === activeTab);
  const visiblePackages = PACKAGES.filter(p => p.kind === activeTab);

  return (
    <div style={{ paddingTop: 96, paddingBottom: 80, minHeight: '100vh', background: C.bg }}>
      <div className="container" style={{ maxWidth: 760 }}>

        {/* Paid success banner */}
        {justPaid && (
          <div style={{
            background: C.primaryLight, border: `1px solid ${C.primary}30`,
            borderRadius: 16, padding: '16px 20px', marginBottom: 28,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <CheckCircle size={20} color={C.primary} style={{ flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 600, color: C.primaryDark, fontSize: '0.9375rem' }}>
                Платёж принят
              </p>
              <p style={{ color: C.gray500, fontSize: '0.8125rem' }}>
                Кредиты появятся в течение минуты — обновите страницу если не отображаются.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <h1 style={{ fontFamily: "'Manrope', sans-serif", fontSize: '1.75rem', fontWeight: 700, color: C.dark, marginBottom: 4 }}>
          Пополнить кредиты
        </h1>
        <p style={{ color: C.gray500, fontSize: '0.9375rem', marginBottom: 8 }}>
          Баланс: <strong style={{ color: C.primary }}>{user?.credits ?? 0} кр.</strong>
        </p>
        <p style={{ color: C.gray400, fontSize: '0.8125rem', marginBottom: 28 }}>
          1 эконом-ролик = 40 кр. · 1 премиум-ролик = 90 кр. · 1 картинка = 13 кр.
        </p>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 28,
          background: C.gray100, borderRadius: 14, padding: 4,
        }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => switchTab(t.key)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '10px 16px', borderRadius: 10, border: 'none',
                  cursor: 'pointer', transition: 'all 0.18s',
                  background: active ? C.white : 'transparent',
                  color: active ? (t.key === 'economy' ? C.primaryDark : '#6D28D9') : C.gray500,
                  fontWeight: 600, fontSize: '0.9rem',
                  boxShadow: active ? C.shadowSm : 'none',
                }}
              >
                <Icon size={16} color={active ? t.accentColor : C.gray400} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab hint */}
        <p style={{ color: C.gray400, fontSize: '0.8125rem', marginBottom: 20 }}>
          {tab.hint}
        </p>

        {error && (
          <p style={{ color: C.danger, fontSize: '0.875rem', marginBottom: 16, background: C.dangerLight, borderRadius: 10, padding: '10px 16px' }}>
            {error}
          </p>
        )}

        {/* Packages grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 48 }}>
          {visiblePackages.map(pkg => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              buying={buying}
              onBuy={handleBuy}
              accentColor={tab.accentColor}
              lightColor={tab.lightColor}
              darkColor={tab.darkColor}
            />
          ))}
        </div>

        {/* Payment history */}
        <section>
          <h2 style={{ fontFamily: "'Manrope', sans-serif", fontSize: '1.125rem', fontWeight: 700, color: C.dark, marginBottom: 16 }}>
            История платежей
          </h2>
          {historyLoading ? (
            <div className="spinner" style={{ margin: '24px auto' }} />
          ) : history.length === 0 ? (
            <p style={{ color: C.gray400, fontSize: '0.875rem' }}>Платежей пока нет.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map(p => <PaymentRow key={p.id} payment={p} />)}
            </div>
          )}
        </section>

        <p style={{ color: C.gray300, fontSize: '0.75rem', marginTop: 40, lineHeight: 1.5 }}>
          Оплата через ЮMoney. Кредиты начисляются автоматически после подтверждения платежа.
          Не является публичной офертой.
        </p>
      </div>
    </div>
  );
}

function PackageCard({ pkg, buying, onBuy, accentColor, lightColor, darkColor }) {
  const isLoading = buying === pkg.id;
  const anyBuying = !!buying;

  return (
    <div style={{
      background: C.white,
      border: `1.5px solid ${pkg.popular ? accentColor : C.gray200}`,
      borderRadius: 16, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 12,
      position: 'relative', transition: 'box-shadow 0.2s',
    }}>
      {pkg.popular && (
        <div style={{
          position: 'absolute', top: -1, right: 16,
          background: accentColor, color: '#fff',
          fontSize: '0.6875rem', fontWeight: 700,
          padding: '3px 10px', borderRadius: '0 0 8px 8px',
          letterSpacing: '0.04em',
        }}>
          ВЫГОДНО
        </div>
      )}
      <div>
        <p style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: '0.9375rem', color: C.dark }}>
          {pkg.title}
        </p>
        <p style={{ color: C.gray400, fontSize: '0.75rem', marginTop: 2 }}>{pkg.subtitle}</p>
      </div>
      <div>
        <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: '1.375rem', color: C.dark }}>
          {pkg.price} ₽
        </span>
        <p style={{ color: accentColor, fontSize: '0.75rem', fontWeight: 600, marginTop: 2 }}>
          {pkg.credits} кредитов
        </p>
      </div>
      <Btn
        variant="primary" size="sm"
        disabled={anyBuying}
        onClick={() => onBuy(pkg)}
        style={{
          background: isLoading ? C.gray200 : `linear-gradient(135deg, ${accentColor}, ${darkColor})`,
          border: 'none',
        }}
      >
        {isLoading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Открываем...
          </span>
        ) : 'Купить'}
      </Btn>
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
      background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12,
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      <StatusIcon size={16} color={statusInfo.color} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 120 }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.dark }}>
          {pkg?.title || payment.package_id}
        </p>
        <p style={{ color: C.gray400, fontSize: '0.75rem' }}>{date}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.dark }}>
          {payment.paid_amount ?? payment.expected_amount} ₽
        </p>
        {payment.credits_granted && (
          <p style={{ color: C.primary, fontSize: '0.75rem', fontWeight: 600 }}>
            +{payment.credits_granted} кр.
          </p>
        )}
      </div>
      <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 6, background: `${statusInfo.color}20`, color: statusInfo.color, fontWeight: 600 }}>
        {statusInfo.label}
      </span>
    </div>
  );
}
