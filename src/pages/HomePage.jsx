import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Play, Sparkles, Share2, ChevronDown, Check, Zap, Lightbulb,
  Settings, Mic, Layout, Globe, ArrowRight, Wand2, Film, Send,
  Volume2, Upload,
} from 'lucide-react';
import { C } from '../lib/theme.js';
import { tariffs } from '../data/tariffs.js';
import Btn from '../components/Btn.jsx';

/* ============================================================
 * Reveal-on-scroll helper (kept from previous version)
 * ============================================================ */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); obs.unobserve(el); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, delay = 0, style, className = '' }) {
  const ref = useReveal();
  const delayClass = delay ? `reveal-delay-${delay}` : '';
  return <div ref={ref} className={`reveal ${delayClass} ${className}`} style={style}>{children}</div>;
}

/* ============================================================
 * Page-scoped styles (responsive bits + hex pattern keyframe)
 * Lives only on the home page, kept here to avoid touching
 * global.css across the project.
 * ============================================================ */
function HomeStyles() {
  return (
    <style>{`
      /* Hero responsive */
      @media (max-width: 1023px) {
        .home-hero { padding: 48px 40px !important; min-height: 0 !important; }
        .home-hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        .home-hero h1 { font-size: 40px !important; }
        .home-browser { max-width: 620px !important; margin: 0 auto !important; }
      }
      @media (max-width: 767px) {
        .home-hero-wrap { padding: 16px !important; }
        .home-hero { padding: 40px 24px !important; }
        .home-hero h1 { font-size: 32px !important; }
        .home-hero .home-cta-row { flex-direction: column !important; gap: 10px !important; }
        .home-hero .home-cta-row > * { width: 100% !important; }
        .home-hero .home-cta-row .btn { width: 100% !important; }
        .home-how-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
      }

      /* Browser body grid is preserved at all sizes (it's miniature) */
      .home-browser-body {
        display: grid;
        grid-template-columns: 1fr 1.4fr 1fr;
        grid-template-rows: auto auto;
        gap: 10px;
      }
    `}</style>
  );
}

export default function HomePage() {
  return (
    <>
      <HomeStyles />
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <FAQ />
      <CTA />
    </>
  );
}

/* ============================================================
 * HERO — rounded dark block, radial emerald gradient,
 * H1 left, browser mockup right, hex pattern overlay
 * ============================================================ */
function Hero() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLoaded(true), 100); return () => clearTimeout(t); }, []);

  // SVG hex pattern as a data-URL background
  const hexBg = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='52' viewBox='0 0 60 52'><path d='M30 0 L60 15 L60 37 L30 52 L0 37 L0 15 Z' fill='none' stroke='%23ffffff' stroke-opacity='0.06' stroke-width='0.7'/></svg>\")";

  return (
    <section
      className="home-hero-wrap"
      style={{
        padding: '24px',
        paddingTop: 96, // 72 header + 24 gap
      }}
    >
      <div
        className="home-hero"
        style={{
          position: 'relative',
          borderRadius: 24,
          overflow: 'hidden',
          background: 'radial-gradient(ellipse 85% 75% at 50% 50%, #1f5043 0%, #143628 45%, #0a1f1a 100%)',
          minHeight: 580,
          padding: '56px 64px',
          isolation: 'isolate',
        }}
      >
        {/* Hex pattern overlay */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: hexBg,
            backgroundRepeat: 'repeat',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div
          className="home-hero-grid"
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: '45fr 55fr',
            gap: 48,
            alignItems: 'center',
            minHeight: 472,
          }}
        >
          {/* LEFT — Copy */}
          <div style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'translateY(0)' : 'translateY(24px)',
            transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.15s',
          }}>
            <h1 style={{
              color: C.white,
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              fontFamily: "'Manrope', sans-serif",
            }}>
              <span style={{ display: 'block' }}>
                Идея <span style={{ color: C.primary }}>&rarr;</span>{' '}
                <span style={{ whiteSpace: 'nowrap' }}>AI&#8209;видео</span>
              </span>
              <span style={{ display: 'block' }}>
                <span style={{ color: C.primary }}>&rarr;</span> публикация
              </span>
              <span style={{ display: 'block' }}>за минуты</span>
            </h1>

            <p style={{
              marginTop: 24,
              maxWidth: 460,
              color: '#c9d1cf',
              fontSize: 16,
              lineHeight: 1.5,
            }}>
              Опишите идею, получите сценарий, озвучку и готовый ролик для VK, Telegram и других площадок.
            </p>

            <div
              className="home-cta-row"
              style={{
                marginTop: 36,
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <Link to="/login">
                <Btn variant="primary" size="lg">Начать бесплатно</Btn>
              </Link>
              <a href="#how">
                <Btn variant="ghost" size="lg">Посмотреть демо</Btn>
              </a>
            </div>
          </div>

          {/* RIGHT — Browser mockup */}
          <div style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? 'translateY(0) scale(1)' : 'translateY(32px) scale(0.97)',
            transition: 'all 0.9s cubic-bezier(0.4, 0, 0.2, 1) 0.4s',
          }}>
            <BrowserMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * BROWSER MOCKUP — raised, light beige panels, 6 cells
 * ============================================================ */
function BrowserMockup() {
  return (
    <div
      className="home-browser"
      role="img"
      aria-label="Предпросмотр интерфейса VideoAI"
      style={{
        width: '100%',
        maxWidth: 720,
        marginLeft: 'auto',
        background: '#1a1a1a',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: [
          '0 1px 0 rgba(255, 255, 255, 0.06) inset',
          '0 30px 60px rgba(0, 0, 0, 0.55)',
          '0 12px 24px rgba(0, 0, 0, 0.4)',
          '0 0 0 1px rgba(16, 185, 129, 0.08)',
          '0 0 80px rgba(16, 185, 129, 0.10)',
        ].join(', '),
      }}
    >
      {/* Topbar */}
      <div style={{
        height: 32,
        background: '#2a2a2a',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', gap: 8 }} aria-hidden="true">
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57', display: 'block' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e', display: 'block' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840', display: 'block' }} />
        </div>
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#3a3a3a',
          borderRadius: 6,
          padding: '3px 12px',
          fontSize: 11,
          color: '#bbb',
        }}>
          ai.videoai.ru
        </div>
      </div>

      {/* 6-cell grid */}
      <div
        className="home-browser-body"
        style={{ background: '#0f0f0f', padding: 14 }}
      >
        <PromptPanel />
        <VideoPanel />
        <SceneListPanel />
        <BigScenePanel />
        <VoiceoverPanel />
        <ExportPanel />
      </div>
    </div>
  );
}

const PANEL_BG = '#e8e4d8';
const PANEL_TEXT = '#2a2a2a';

function MiniPanel({ children, style }) {
  return (
    <div style={{
      background: PANEL_BG,
      color: PANEL_TEXT,
      borderRadius: 10,
      padding: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      ...(style || {}),
    }}>
      {children}
    </div>
  );
}

function MiniTitle({ children, accent }) {
  return (
    <h4 style={{
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: accent ? C.primary : '#888',
      fontWeight: 600,
      fontFamily: 'inherit',
    }}>{children}</h4>
  );
}

function PromptPanel() {
  return (
    <MiniPanel>
      <MiniTitle>Промпт</MiniTitle>
      <div style={{
        background: '#fff',
        borderRadius: 6,
        padding: '7px 10px',
        height: 28,
        fontSize: 11,
        color: '#999',
        display: 'flex',
        alignItems: 'center',
      }}>Напишите идею…</div>
      <div style={{
        background: '#d4cfc0',
        borderRadius: 6,
        padding: '8px 10px',
        fontSize: 11,
        lineHeight: 1.4,
        color: '#3a3a3a',
      }}>
        Ролик о запуске кроссовок в futuristic city
      </div>
      <div style={{
        background: C.primary,
        color: '#fff',
        borderRadius: 6,
        padding: 7,
        fontSize: 11,
        fontWeight: 600,
        textAlign: 'center',
        marginTop: 'auto',
      }}>
        Генерация…
      </div>
    </MiniPanel>
  );
}

function VideoPanel() {
  return (
    <MiniPanel>
      <MiniTitle accent>Генерация</MiniTitle>
      {/* Progress bar */}
      <div style={{ height: 3, background: '#d4cfc0', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: '70%', background: C.primary, borderRadius: 2 }} />
      </div>

      {/* Video frame */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/10',
        borderRadius: 8,
        overflow: 'hidden',
        background:
          'radial-gradient(ellipse at 50% 60%, transparent 30%, rgba(0,0,0,0.4) 100%), ' +
          'linear-gradient(180deg, #4a3825 0%, #8a5a3a 40%, #d4823e 70%, #2a1a15 100%)',
      }}>
        {/* City silhouette */}
        <svg
          aria-hidden="true"
          viewBox="0 0 400 100"
          preserveAspectRatio="xMidYEnd slice"
          style={{ position: 'absolute', left: 0, right: 0, bottom: '28%', width: '100%', height: '26%' }}
        >
          <g fill="#1a0a05" opacity="0.85">
            <rect x="10" y="50" width="14" height="50" />
            <rect x="26" y="38" width="20" height="62" />
            <rect x="48" y="56" width="10" height="44" />
            <rect x="60" y="32" width="18" height="68" />
            <rect x="80" y="48" width="12" height="52" />
            <rect x="94" y="52" width="22" height="48" />
            <rect x="118" y="40" width="14" height="60" />
            <polygon points="134,40 144,28 154,40 154,100 134,100" />
            <rect x="158" y="50" width="10" height="50" />
            <rect x="170" y="42" width="22" height="58" />
            <rect x="194" y="48" width="14" height="52" />
            <rect x="210" y="36" width="18" height="64" />
            <rect x="230" y="52" width="12" height="48" />
            <polygon points="246,48 254,38 262,48 262,100 246,100" />
            <rect x="266" y="44" width="16" height="56" />
            <rect x="284" y="52" width="12" height="48" />
            <rect x="298" y="40" width="20" height="60" />
            <rect x="320" y="48" width="14" height="52" />
            <rect x="336" y="56" width="10" height="44" />
            <rect x="350" y="44" width="16" height="56" />
            <rect x="368" y="50" width="12" height="50" />
            <rect x="382" y="48" width="12" height="52" />
          </g>
          <g fill="#ffd89a" opacity="0.55">
            {[14,30,65,84,98,122,162,176,198,216,234,272,304,324,354,372].map((x, i) => (
              <rect key={x} x={x} y={i % 2 === 0 ? 62 : 50} width="1.5" height="3" />
            ))}
          </g>
        </svg>

        {/* Runner silhouette */}
        <svg
          aria-hidden="true"
          viewBox="0 0 60 110"
          style={{
            position: 'absolute',
            left: '50%',
            top: '38%',
            transform: 'translate(-50%, -50%)',
            width: '26%',
          }}
        >
          <g fill="#0a0503">
            <circle cx="28" cy="14" r="11" />
            <path d="M17 28 L39 28 L46 60 L40 96 L30 96 L26 70 Z" />
            <path d="M17 36 L-2 52 L4 60 L22 44 Z" />
            <path d="M39 32 L58 26 L63 34 L43 44 Z" />
            <path d="M40 82 L58 108 L54 118 L34 96 Z" />
            <path d="M28 88 L14 126 L22 130 L34 100 Z" />
          </g>
          <g fill="#ffc58a" opacity="0.6">
            <ellipse cx="30" cy="12" rx="3.5" ry="2.5" />
            <rect x="38" y="26" width="3" height="12" />
            <rect x="40" y="80" width="3" height="12" />
          </g>
        </svg>
      </div>

      {/* Controls */}
      <div style={{
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b6b6b', fontSize: 9 }}>
          <span style={{
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: '5px 0 5px 8px',
            borderColor: 'transparent transparent transparent #2a2a2a',
            display: 'inline-block',
          }} aria-hidden="true" />
          <span>0:12 / 0:45</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b6b6b', fontSize: 12 }} aria-hidden="true">
          <span>🔊</span>
          <span>⛶</span>
          <span>⚙</span>
        </div>
      </div>
    </MiniPanel>
  );
}

function SceneListPanel() {
  const scenes = [
    'linear-gradient(180deg, #4a2818 0%, #b65a2a 50%, #f4a04e 100%)',
    'linear-gradient(180deg, #0a1a3c 0%, #1e3a6e 50%, #4a8bc8 100%)',
    'linear-gradient(180deg, #2a0a3a 0%, #5a1f6e 50%, #c87ad6 100%)',
  ];
  return (
    <MiniPanel>
      <MiniTitle>Сцены</MiniTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {scenes.map((bg, i) => (
          <div key={i} style={{
            position: 'relative',
            height: 36,
            borderRadius: 6,
            overflow: 'hidden',
            background: bg,
          }}>
            <ScenePlay size={18} />
          </div>
        ))}
      </div>
    </MiniPanel>
  );
}

function BigScenePanel() {
  return (
    <MiniPanel>
      <MiniTitle>Сцены</MiniTitle>
      <div style={{
        position: 'relative',
        width: '100%',
        flex: 1,
        minHeight: 90,
        borderRadius: 6,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #1a0a3a 0%, #3a1f6e 45%, #6a4ac8 85%, #8a6adc 100%)',
      }}>
        <ScenePlay size={32} big />
      </div>
    </MiniPanel>
  );
}

function ScenePlay({ size = 18, big = false }) {
  return (
    <span style={{
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.9)',
      display: 'grid',
      placeItems: 'center',
    }} aria-hidden="true">
      <span style={{
        width: 0,
        height: 0,
        borderStyle: 'solid',
        borderWidth: big ? '8px 0 8px 13px' : '4px 0 4px 7px',
        borderColor: 'transparent transparent transparent #2a2a2a',
        marginLeft: big ? 2 : 1,
        display: 'inline-block',
      }} />
    </span>
  );
}

function VoiceoverPanel() {
  return (
    <MiniPanel>
      <MiniTitle>Озвучка</MiniTitle>
      <VoiceRow
        name="Татьяна"
        avatarBg="linear-gradient(135deg, #fde2c8 0%, #f4a187 100%)"
      />
      <VoiceRow
        name="Максим"
        avatarBg="linear-gradient(135deg, #c8d4e0 0%, #7a98b8 100%)"
      />
    </MiniPanel>
  );
}

function VoiceRow({ name, avatarBg }) {
  // 25 bars 4–14px, ~60% active (15 green, 10 gray)
  const heights = [6, 9, 4, 12, 8, 5, 11, 7, 14, 9, 6, 4, 10, 13, 8, 5, 7, 11, 9, 4, 6, 12, 8, 5, 10];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: avatarBg, flexShrink: 0 }} />
      <div style={{ fontSize: 11, color: PANEL_TEXT, fontWeight: 500, width: 50, flexShrink: 0 }}>{name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, height: 14 }}>
        {heights.map((h, i) => (
          <span key={i} style={{
            width: 2,
            height: h,
            borderRadius: 1,
            background: i < 15 ? C.primary : '#aaa',
            display: 'inline-block',
          }} />
        ))}
      </div>
    </div>
  );
}

function ExportPanel() {
  return (
    <MiniPanel>
      <MiniTitle>Экспорт</MiniTitle>
      <div style={{ display: 'flex', gap: 6 }}>
        <SocialButton label="VK" aria="VK" bg="#0077FF">VK</SocialButton>
        <SocialButton label="Telegram" aria="Telegram" bg="#229ED9">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M21.94 4.5L18.7 19.93c-.24 1.08-.88 1.35-1.78.84l-4.92-3.63-2.37 2.28c-.26.26-.48.48-.99.48l.35-5.01 9.12-8.24c.4-.35-.09-.55-.62-.2l-11.27 7.1L1.4 12.06c-1.06-.33-1.08-1.06.22-1.57l19.06-7.35c.88-.33 1.66.2 1.26 3.36z" />
          </svg>
        </SocialButton>
        <SocialButton label="Instagram" aria="Instagram"
          bg="linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="#fff" />
          </svg>
        </SocialButton>
      </div>
      <div style={{
        background: C.primary,
        color: '#fff',
        borderRadius: 6,
        padding: 7,
        fontSize: 11,
        fontWeight: 600,
        textAlign: 'center',
        marginTop: 'auto',
      }}>
        Опубликовать
      </div>
    </MiniPanel>
  );
}

function SocialButton({ children, bg, aria }) {
  return (
    <div
      role="img"
      aria-label={aria}
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        background: bg,
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

/* ============================================================
 * HOW IT WORKS — 3 cards with subtle gradient bg
 * ============================================================ */
function HowItWorks() {
  const steps = [
    {
      n: '1',
      icon: Lightbulb,
      title: 'Идея',
      desc: 'Опишите идею ролика своими словами — AI поймёт суть и предложит сценарий за секунды.',
    },
    {
      n: '2',
      icon: Settings,
      title: 'Генерация AI',
      desc: 'AI собирает сценарий, генерирует видеоряд и озвучку под выбранную площадку.',
    },
    {
      n: '3',
      icon: Share2,
      title: 'Публикация',
      desc: 'Публикуйте ролик одним кликом в VK, Telegram, Instagram и другие соцсети.',
    },
  ];

  return (
    <section id="how" style={{ background: C.white, padding: '80px 0' }}>
      <div className="container">
        <Reveal>
          <h2 className="section-title">Как это работает</h2>
          <p className="section-subtitle">Три шага от идеи до публикации — без навыков монтажа</p>
        </Reveal>

        <div
          className="home-how-grid"
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
            padding: '0 24px',
          }}
        >
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i + 1}>
              <article style={{
                background:
                  'radial-gradient(120% 100% at 0% 0%, rgba(16,185,129,0.06) 0%, transparent 55%), ' +
                  'linear-gradient(180deg, #f6f8f7 0%, #eaf0ed 100%)',
                border: '1px solid #dde4e0',
                borderRadius: 16,
                padding: 28,
                transition: 'box-shadow 200ms ease, transform 200ms ease',
                height: '100%',
              }}>
                <div
                  aria-hidden="true"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#ecfdf5',
                    display: 'grid',
                    placeItems: 'center',
                    color: C.primary,
                  }}
                >
                  <s.icon size={22} strokeWidth={2} />
                </div>
                <h3 style={{
                  marginTop: 20,
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#0a0a0a',
                  fontFamily: "'Manrope', sans-serif",
                  letterSpacing: '-0.01em',
                }}>
                  {s.n}. {s.title}
                </h3>
                <p style={{
                  marginTop: 8,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: '#666',
                }}>
                  {s.desc}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * FEATURES — bento grid (kept from previous version)
 * ============================================================ */
function Features() {
  return (
    <section id="features" className="section" style={{
      background: `linear-gradient(180deg, ${C.bg} 0%, ${C.bgMint} 100%)`,
    }}>
      <div className="container">
        <Reveal>
          <h2 className="section-title">Возможности платформы</h2>
          <p className="section-subtitle">Единый кабинет для создания и публикации AI-видео</p>
        </Reveal>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: 20,
        }}>
          <Reveal style={{ gridColumn: 'span 7' }}>
            <div className="card" style={{
              padding: 36, height: '100%',
              background: `linear-gradient(135deg, ${C.dark} 0%, ${C.darkPine} 100%)`,
              border: `1px solid ${C.darkBorder}`,
              color: C.white,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'rgba(16,185,129,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20, border: '1px solid rgba(16,185,129,0.15)',
              }}>
                <Sparkles size={22} color={C.primary} />
              </div>
              <h3 style={{ fontSize: '1.35rem', marginBottom: 10, fontWeight: 700 }}>AI-сценарии от GigaChat</h3>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9375rem', lineHeight: 1.65, maxWidth: 400 }}>
                Опишите тему — получите 3 варианта сценария с раскадровкой. Выбирайте лучший или редактируйте.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                {['Рекламный', 'Информативный', 'Эмоциональный'].map(tag => (
                  <span key={tag} style={{
                    padding: '5px 12px', borderRadius: 8,
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)',
                    fontSize: '0.6875rem', fontWeight: 600, color: C.primary,
                  }}>{tag}</span>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={1} style={{ gridColumn: 'span 5' }}>
            <div className="card" style={{ padding: 36, height: '100%' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: C.primaryLight,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
              }}>
                <Layout size={22} color={C.primaryDark} />
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: 10, fontWeight: 700 }}>5 шаблонов видео</h3>
              <p style={{ color: C.gray500, fontSize: '0.9375rem', lineHeight: 1.6 }}>
                Анонс товара, цитата дня, до/после, сторителлинг, карусель — под любой формат соцсетей.
              </p>
            </div>
          </Reveal>

          <Reveal delay={1} style={{ gridColumn: 'span 4' }}>
            <div className="card" style={{ padding: 36, height: '100%' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: C.primaryLight,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
              }}>
                <Mic size={22} color={C.primaryDark} />
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: 10, fontWeight: 700 }}>Озвучка SpeechKit</h3>
              <p style={{ color: C.gray500, fontSize: '0.875rem', lineHeight: 1.6 }}>
                4 голоса Яндекса — мужские и женские, спокойные и эмоциональные.
              </p>
            </div>
          </Reveal>

          <Reveal delay={2} style={{ gridColumn: 'span 4' }}>
            <div className="card" style={{ padding: 36, height: '100%' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: C.primaryLight,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
              }}>
                <Share2 size={22} color={C.primaryDark} />
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: 10, fontWeight: 700 }}>Публикация в 1 клик</h3>
              <p style={{ color: C.gray500, fontSize: '0.875rem', lineHeight: 1.6 }}>
                VK-группы, Telegram-каналы — подключите и публикуйте из кабинета.
              </p>
            </div>
          </Reveal>

          <Reveal delay={3} style={{ gridColumn: 'span 4' }}>
            <div className="card" style={{ padding: 36, height: '100%' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: C.primaryLight,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
              }}>
                <Zap size={22} color={C.primaryDark} />
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: 10, fontWeight: 700 }}>Готово за 3 минуты</h3>
              <p style={{ color: C.gray500, fontSize: '0.875rem', lineHeight: 1.6 }}>
                Ролик 9:16 с озвучкой для сторис — от описания до файла за минуты.
              </p>
            </div>
          </Reveal>

          <Reveal delay={2} style={{ gridColumn: 'span 12' }}>
            <div className="card" style={{
              padding: '32px 36px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 24, flexWrap: 'wrap',
              background: C.bgMint,
              border: `1px solid rgba(16,185,129,0.12)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: C.primaryLight,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Globe size={22} color={C.primaryDark} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 2 }}>Полностью российский стек</h3>
                  <p style={{ color: C.gray500, fontSize: '0.9375rem' }}>GigaChat · Kandinsky · SpeechKit — работает без VPN, оплата в рублях</p>
                </div>
              </div>
              <Link to="/login">
                <Btn variant="primary" size="sm">
                  Попробовать <ArrowRight size={16} />
                </Btn>
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * PRICING — kept from previous version
 * ============================================================ */
function Pricing() {
  return (
    <section id="pricing" className="section" style={{ background: C.white }}>
      <div className="container">
        <Reveal>
          <h2 className="section-title">Простые тарифы</h2>
          <p className="section-subtitle">Начните бесплатно — масштабируйтесь когда будете готовы</p>
        </Reveal>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 24,
          maxWidth: 1020,
          margin: '0 auto',
        }}>
          {tariffs.map((t, idx) => (
            <Reveal key={t.id} delay={idx + 1}>
              <div style={{
                position: 'relative',
                background: t.popular
                  ? `linear-gradient(135deg, ${C.dark} 0%, ${C.darkPine} 100%)`
                  : C.white,
                border: t.popular
                  ? `1px solid rgba(16,185,129,0.2)`
                  : `1px solid ${C.gray200}`,
                borderRadius: 24,
                padding: '40px 32px 36px',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                boxShadow: t.popular ? C.shadowGlow : C.shadowSm,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}>
                {t.popular && (
                  <div style={{
                    position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                    background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
                    color: C.white, padding: '6px 20px', borderRadius: 100,
                    fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.03em',
                    boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
                  }}>Популярный</div>
                )}

                <div style={{ marginBottom: 28 }}>
                  <h3 style={{
                    fontSize: '1.2rem', marginBottom: 6, fontWeight: 700,
                    color: t.popular ? C.white : C.dark,
                  }}>{t.name}</h3>
                  <p style={{
                    fontSize: '0.875rem',
                    color: t.popular ? 'rgba(255,255,255,0.5)' : C.gray500,
                  }}>{t.description}</p>
                </div>

                <div style={{ marginBottom: 28 }}>
                  <span style={{
                    fontSize: '2.75rem', fontWeight: 800,
                    fontFamily: "'Manrope', sans-serif",
                    letterSpacing: '-0.03em',
                    color: t.popular ? C.white : C.dark,
                  }}>
                    {t.price === 0 ? '0' : t.price.toLocaleString('ru-RU')}
                  </span>
                  <span style={{
                    fontSize: '0.9375rem', fontWeight: 500, marginLeft: 6,
                    color: t.popular ? 'rgba(255,255,255,0.4)' : C.gray400,
                  }}>
                    {t.price === 0 ? 'кредитов' : '₽'}
                  </span>
                </div>

                <ul style={{
                  listStyle: 'none', marginBottom: 32, flex: 1,
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  {t.features.map((f, i) => (
                    <li key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      fontSize: '0.9375rem',
                      color: t.popular ? 'rgba(255,255,255,0.75)' : C.gray600,
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 6,
                        background: t.popular ? 'rgba(16,185,129,0.15)' : C.primaryLight,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Check size={13} color={C.primary} strokeWidth={2.5} />
                      </div>
                      {f}
                    </li>
                  ))}
                  {t.limits.map((l, i) => (
                    <li key={`l${i}`} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      fontSize: '0.9375rem',
                      color: t.popular ? 'rgba(255,255,255,0.3)' : C.gray400,
                    }}>
                      <span style={{ width: 20, textAlign: 'center', flexShrink: 0, fontSize: '0.75rem' }}>—</span>
                      {l}
                    </li>
                  ))}
                </ul>

                <Link to="/login" style={{ width: '100%' }}>
                  <Btn
                    variant={t.popular ? 'primary' : 'outline'}
                    size="lg"
                    style={{ width: '100%' }}
                  >
                    {t.price === 0 ? 'Начать бесплатно' : 'Выбрать тариф'}
                  </Btn>
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * FAQ — kept from previous version
 * ============================================================ */
function FAQ() {
  const items = [
    { q: 'Какие форматы видео поддерживаются?', a: 'На старте — вертикальное видео 9:16 длительностью 15 и 30 секунд. Идеально для сторис VK, Telegram и коротких роликов.' },
    { q: 'Сколько стоит создание одного видео?', a: 'Зависит от шаблона. Простое видео с озвучкой — от 6 кредитов (~12 ₽). Видео с AI-генерацией визуала — от 20 кредитов (~40 ₽).' },
    { q: 'Можно ли использовать без VPN?', a: 'Да! VideoAI работает полностью на российском стеке: GigaChat, Kandinsky, Yandex SpeechKit. Никакие зарубежные API не нужны.' },
    { q: 'Как работает публикация в соцсети?', a: 'Подключаете VK-группу через OAuth или Telegram-канал через нашего бота. После этого публикуете видео в один клик прямо из кабинета.' },
    { q: 'Есть ли бесплатный тариф?', a: 'Да, при регистрации начисляем 30 кредитов — этого хватит на 2-3 видео с озвучкой, чтобы протестировать сервис.' },
  ];

  return (
    <section id="faq" className="section" style={{ background: C.bg }}>
      <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
        <Reveal>
          <h2 className="section-title">Частые вопросы</h2>
          <p className="section-subtitle">Не нашли ответ? Напишите нам</p>
        </Reveal>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item, i) => (
            <Reveal key={i} delay={Math.min(i + 1, 4)}>
              <FAQItem question={item.q} answer={item.a} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(!open)}
      style={{
        background: C.white,
        border: `1px solid ${open ? 'rgba(16,185,129,0.2)' : C.gray200}`,
        borderRadius: 16,
        padding: '22px 28px',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: open ? '0 4px 24px rgba(16,185,129,0.06)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: C.dark }}>{question}</h3>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: open ? C.primaryLight : C.gray100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'all 0.3s ease',
        }}>
          <ChevronDown
            size={16}
            color={open ? C.primary : C.gray400}
            style={{ transition: 'transform 0.3s ease', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
          />
        </div>
      </div>
      <div style={{
        maxHeight: open ? 200 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <p style={{
          color: C.gray500, fontSize: '0.9375rem', lineHeight: 1.7,
          marginTop: 14, paddingTop: 14,
          borderTop: `1px solid ${C.gray100}`,
        }}>
          {answer}
        </p>
      </div>
    </div>
  );
}

/* ============================================================
 * FINAL CTA — kept from previous version
 * ============================================================ */
function CTA() {
  return (
    <section style={{
      position: 'relative',
      padding: '100px 0',
      background: `radial-gradient(ellipse 80% 50% at 50% 100%, ${C.darkPine} 0%, ${C.dark} 70%)`,
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
        width: '80%', height: '50%',
        background: 'radial-gradient(ellipse, rgba(16,185,129,0.1) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div className="container" style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
        <Reveal>
          <h2 style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
            fontWeight: 800, color: C.white,
            letterSpacing: '-0.03em',
            marginBottom: 16,
          }}>
            Готовы создать первое AI-видео?
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.5)', fontSize: '1.125rem',
            maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.7,
          }}>
            30 бесплатных кредитов при регистрации. Без привязки карты — начните прямо сейчас.
          </p>
          <Link to="/login">
            <Btn variant="primary" size="lg">
              Начать бесплатно <ArrowRight size={18} />
            </Btn>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
