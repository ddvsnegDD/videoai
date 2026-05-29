import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { C } from '../lib/theme.js';

export default function GenerationProgress({ job }) {
  if (!job) return null;

  if (job.status === 'done') {
    return (
      <div style={wrapStyle}>
        <div style={{ ...iconWrap, background: C.primaryLight }}>
          <Check size={24} color={C.primary} />
        </div>
        <p style={{ color: C.primary, fontWeight: 600, fontSize: '0.9375rem' }}>Готово</p>
      </div>
    );
  }

  if (job.status === 'failed') {
    return (
      <div style={wrapStyle}>
        <div style={{ ...iconWrap, background: C.dangerLight }}>
          <AlertCircle size={24} color={C.danger} />
        </div>
        <p style={{ color: C.danger, fontWeight: 600, fontSize: '0.9375rem', marginBottom: 4 }}>Ошибка</p>
        <p style={{ color: C.gray500, fontSize: '0.8125rem' }}>{job.error || 'Неизвестная ошибка'}</p>
      </div>
    );
  }

  // pending / running
  return (
    <div style={wrapStyle}>
      <Loader2
        size={32}
        color={C.primary}
        style={{ animation: 'spin 0.7s linear infinite', marginBottom: 16 }}
      />
      <p style={{ color: C.dark, fontWeight: 600, fontSize: '0.9375rem', marginBottom: 4 }}>
        {job.status === 'pending' ? 'В очереди...' : 'Генерация...'}
      </p>
      {job.progress > 0 && (
        <div style={{ width: '100%', maxWidth: 240 }}>
          <div style={{
            height: 6,
            borderRadius: 3,
            background: C.gray100,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${job.progress}%`,
              borderRadius: 3,
              background: `linear-gradient(90deg, ${C.primary}, ${C.primaryDark})`,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <p style={{ color: C.gray400, fontSize: '0.75rem', textAlign: 'center', marginTop: 6 }}>
            {job.progress}%
          </p>
        </div>
      )}
      <p style={{ color: C.gray400, fontSize: '0.8125rem', marginTop: 8 }}>
        Придумываю 3 варианта... обычно 15-20 секунд
      </p>
    </div>
  );
}

const wrapStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '48px 24px',
  textAlign: 'center',
};

const iconWrap = {
  width: 56,
  height: 56,
  borderRadius: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 16,
};
