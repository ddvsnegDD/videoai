import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { C } from '../lib/theme.js';

export default function GenerationProgress({ job, type }) {
  if (!job) return null;

  const isImage = type === 'image';

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

  const progress = job.progress || 0;

  return (
    <div style={wrapStyle}>
      <Loader2
        size={32} color={C.primary}
        style={{ animation: 'spin 0.7s linear infinite', marginBottom: 16 }}
      />
      <p style={{ color: C.dark, fontWeight: 600, fontSize: '0.9375rem', marginBottom: 4 }}>
        {job.status === 'pending'
          ? 'В очереди...'
          : isImage
            ? 'Генерирую картинку...'
            : 'Оживляю товар...'}
      </p>
      <div style={{ width: '100%', maxWidth: 280 }}>
        <div style={{ height: 6, borderRadius: 3, background: C.gray100, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.max(progress, job.status === 'running' ? 5 : 0)}%`,
            borderRadius: 3,
            background: `linear-gradient(90deg, ${C.primary}, ${C.primaryDark})`,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <p style={{ color: C.gray400, fontSize: '0.75rem', textAlign: 'center', marginTop: 6 }}>{progress}%</p>
      </div>
      <p style={{ color: C.gray400, fontSize: '0.8125rem', marginTop: 8 }}>
        {isImage ? 'Обычно 15-30 секунд' : 'Генерация видео... обычно 1-3 минуты'}
      </p>
    </div>
  );
}

const wrapStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: '48px 24px', textAlign: 'center',
};

const iconWrap = {
  width: 56, height: 56, borderRadius: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  marginBottom: 16,
};
