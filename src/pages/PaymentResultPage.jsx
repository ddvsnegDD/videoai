// src/pages/PaymentResultPage.jsx
// Страница-результат после редиректа из ЮKassa.
// Поллит статус платежа, показывает результат.
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { C } from '../lib/theme';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const POLL_INTERVAL = 3000; // 3s
const MAX_POLLS = 40;       // 2 min max

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [status, setStatus] = useState('loading'); // loading | completed | canceled | error | timeout
  const [payment, setPayment] = useState(null);
  const pollCountRef = useRef(0);
  const timerRef = useRef(null);

  // paymentId from query string OR localStorage (YooKassa redirect has no custom params)
  const paymentId = searchParams.get('paymentId') || localStorage.getItem('lastPaymentId');

  useEffect(() => {
    if (!paymentId) {
      setStatus('error');
      return;
    }
    // Clean up localStorage after reading
    localStorage.removeItem('lastPaymentId');

    let cancelled = false;

    async function checkStatus() {
      if (cancelled) return;
      pollCountRef.current++;

      try {
        const data = await api.get(`/payments/order/${paymentId}/status`);
        if (cancelled) return;

        const p = data.payment;
        setPayment(p);

        if (p.status === 'completed') {
          setStatus('completed');
          refresh(); // update credits in header
          return; // stop polling
        }

        if (p.status === 'canceled' || p.status === 'mismatch') {
          setStatus('canceled');
          return; // stop polling
        }

        // Still pending — continue polling
        if (pollCountRef.current >= MAX_POLLS) {
          setStatus('timeout');
          return;
        }

        timerRef.current = setTimeout(checkStatus, POLL_INTERVAL);
      } catch (err) {
        if (cancelled) return;
        if (pollCountRef.current >= MAX_POLLS) {
          setStatus('timeout');
          return;
        }
        // Retry on network errors
        timerRef.current = setTimeout(checkStatus, POLL_INTERVAL);
      }
    }

    checkStatus();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [paymentId]);

  const containerStyle = {
    background: 'linear-gradient(135deg, #EFF6F0 0%, #EBF3F5 50%, #F3EBF5 100%)',
    minHeight: 'calc(100vh - 70px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  };

  const cardStyle = {
    background: '#fff',
    borderRadius: 24,
    padding: '48px 40px',
    maxWidth: 440,
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 12px 40px rgba(10, 46, 31, 0.06)',
  };

  if (status === 'loading') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ marginBottom: 24 }}>
            <Clock size={48} color={C.primary} style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.dark, marginBottom: 12, fontFamily: '"Manrope", sans-serif' }}>
            Проверяем оплату...
          </h1>
          <p style={{ color: C.gray500, fontSize: 15, lineHeight: 1.5 }}>
            Ожидаем подтверждение от платёжной системы. Обычно это занимает несколько секунд.
          </p>
          <div className="spinner" style={{ margin: '24px auto 0' }} />
        </div>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: C.primaryLight, display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 24px',
          }}>
            <CheckCircle size={40} color={C.primary} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.dark, marginBottom: 12, fontFamily: '"Manrope", sans-serif' }}>
            Оплата прошла!
          </h1>
          <p style={{ color: C.gray500, fontSize: 15, lineHeight: 1.5, marginBottom: 8 }}>
            Кредиты зачислены на ваш баланс.
          </p>
          {payment?.credits_granted && (
            <p style={{ color: C.primary, fontSize: 28, fontWeight: 800, marginBottom: 24 }}>
              +{payment.credits_granted} кредитов
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/editor')}
              style={{
                padding: '12px 28px', borderRadius: 12, border: 'none',
                background: C.primary, color: '#fff', fontWeight: 600,
                fontSize: 15, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16,185,129,0.2)',
              }}
            >
              Создать видео
            </button>
            <button
              onClick={() => navigate('/billing')}
              style={{
                padding: '12px 28px', borderRadius: 12,
                border: `1px solid ${C.gray200}`, background: '#fff',
                color: C.gray600, fontWeight: 600, fontSize: 15, cursor: 'pointer',
              }}
            >
              К тарифам
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'canceled') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: '#FEE2E2', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 24px',
          }}>
            <XCircle size={40} color={C.danger} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.dark, marginBottom: 12, fontFamily: '"Manrope", sans-serif' }}>
            Платёж отменён
          </h1>
          <p style={{ color: C.gray500, fontSize: 15, lineHeight: 1.5, marginBottom: 24 }}>
            Оплата не прошла или была отменена. Деньги не списаны.
          </p>
          <button
            onClick={() => navigate('/billing')}
            style={{
              padding: '12px 28px', borderRadius: 12, border: 'none',
              background: C.primary, color: '#fff', fontWeight: 600,
              fontSize: 15, cursor: 'pointer',
            }}
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // timeout or error
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: '#FEF3C7', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 24px',
        }}>
          <AlertCircle size={40} color="#F59E0B" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.dark, marginBottom: 12, fontFamily: '"Manrope", sans-serif' }}>
          {status === 'timeout' ? 'Ожидание затянулось' : 'Ошибка проверки'}
        </h1>
        <p style={{ color: C.gray500, fontSize: 15, lineHeight: 1.5, marginBottom: 24 }}>
          {status === 'timeout'
            ? 'Не удалось получить подтверждение. Если деньги списались — кредиты будут начислены автоматически в течение нескольких минут.'
            : 'Не удалось проверить статус платежа. Попробуйте обновить страницу.'}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 28px', borderRadius: 12, border: 'none',
              background: C.primary, color: '#fff', fontWeight: 600,
              fontSize: 15, cursor: 'pointer',
            }}
          >
            Обновить
          </button>
          <button
            onClick={() => navigate('/billing')}
            style={{
              padding: '12px 28px', borderRadius: 12,
              border: `1px solid ${C.gray200}`, background: '#fff',
              color: C.gray600, fontWeight: 600, fontSize: 15, cursor: 'pointer',
            }}
          >
            К тарифам
          </button>
        </div>
      </div>
    </div>
  );
}
