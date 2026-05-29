import { Image, Volume2, AlertTriangle, RefreshCw } from 'lucide-react';
import { C } from '../lib/theme.js';
import Btn from './Btn.jsx';

export default function Storyboard({ scenes, scenesMedia }) {
  if (!scenes || !scenesMedia) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {scenes.map((scene, i) => {
        const media = scenesMedia[i] || {};
        const hasFailed = !media.image_url && !media.audio_url && scenesMedia.length > i;

        return (
          <SceneCard
            key={i}
            index={i}
            scene={scene}
            imageUrl={media.image_url}
            audioUrl={media.audio_url}
            failed={hasFailed}
          />
        );
      })}
    </div>
  );
}

function SceneCard({ index, scene, imageUrl, audioUrl, failed }) {
  return (
    <div style={{
      background: C.white,
      border: `1px solid ${failed ? C.danger + '40' : C.gray200}`,
      borderRadius: 20,
      overflow: 'hidden',
      transition: 'box-shadow 0.2s',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: imageUrl ? '140px 1fr' : '1fr',
        gap: 0,
      }}>
        {/* Image preview */}
        {imageUrl ? (
          <div style={{
            position: 'relative',
            aspectRatio: '9/16',
            maxHeight: 248,
            overflow: 'hidden',
            background: C.gray100,
          }}>
            <img
              src={imageUrl}
              alt={`Сцена ${index + 1}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            <div style={{
              position: 'absolute',
              top: 8,
              left: 8,
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'rgba(0, 0, 0, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: C.white,
              fontSize: '0.75rem',
              fontWeight: 700,
            }}>
              {index + 1}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'none',
          }} />
        )}

        {/* Content */}
        <div style={{ padding: 20 }}>
          {!imageUrl && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: failed ? C.dangerLight : C.gray100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: failed ? C.danger : C.gray500,
              }}>
                {index + 1}
              </div>
              {failed && (
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: C.danger,
                  padding: '2px 8px',
                  borderRadius: 5,
                  background: C.dangerLight,
                }}>
                  Ошибка генерации
                </span>
              )}
            </div>
          )}

          <p style={{
            fontSize: '0.875rem',
            color: C.dark,
            lineHeight: 1.6,
            marginBottom: 12,
          }}>
            {scene.description}
          </p>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: C.gray400,
            fontSize: '0.75rem',
            marginBottom: audioUrl ? 12 : 0,
          }}>
            <span>{scene.duration_sec}с</span>
            {!imageUrl && !failed && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Image size={11} /> Нет картинки
              </span>
            )}
          </div>

          {/* Audio player */}
          {audioUrl && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <Volume2 size={14} color={C.primary} style={{ flexShrink: 0 }} />
              <audio
                controls
                src={audioUrl}
                preload="none"
                style={{
                  height: 32,
                  flex: 1,
                  borderRadius: 8,
                }}
              />
            </div>
          )}

          {/* Failed state */}
          {failed && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              background: '#FEF3C7',
              borderRadius: 10,
              marginTop: 12,
            }}>
              <AlertTriangle size={14} color="#92400E" />
              <span style={{ fontSize: '0.8125rem', color: '#92400E' }}>
                Не удалось сгенерировать, кредиты возвращены
              </span>
            </div>
          )}

          {/* Regenerate stub */}
          {(imageUrl || audioUrl) && (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => {
                  // TODO: individual scene regeneration
                  const event = new CustomEvent('toast', {
                    detail: { message: 'Перегенерация отдельных сцен будет в следующем обновлении', type: 'info' },
                  });
                  window.dispatchEvent(event);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  color: C.gray400,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = C.primary}
                onMouseLeave={e => e.currentTarget.style.color = C.gray400}
              >
                <RefreshCw size={11} /> Перегенерировать
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
