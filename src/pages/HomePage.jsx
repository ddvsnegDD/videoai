import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Play, Sparkles, Share2, ChevronDown, Check, Zap, Video,
  MessageSquare, Mic, Layout, Clock, Globe, ArrowRight,
  Wand2, Film, Send, Image, Volume2, Upload,
} from 'lucide-react';
import { C } from '../lib/theme.js';
import { tariffs } from '../data/tariffs.js';
import Btn from '../components/Btn.jsx';

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

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <FAQ />
      <CTA />
    </>
  );
}

/* ====== HERO — LIGHT, TEXT LEFT + MOCKUP RIGHT ====== */
function Hero() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLoaded(true), 100); return () => clearTimeout(t); }, []);

  return (
    <section style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      background: '#F4F7F5',
      paddingTop: 72,
    }}>
      {/* === LAYERED LIGHT BACKGROUND === */}
      {/* Base warm gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, #F0F5F2 0%, #E8F0EC 30%, #F4F7F5 60%, #EDF5F0 100%)',
        pointerEvents: 'none',
      }} />
      {/* Soft emerald glow top-right */}
      <div style={{
        position: 'absolute', top: '-10%', right: '-5%',
        width: '60%', height: '80%',
        background: 'radial-gradient(ellipse 70% 60% at 60% 30%, rgba(16,185,129,0.07) 0%, rgba(16,185,129,0.02) 50%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* Warm glow bottom-left */}
      <div style={{
        position: 'absolute', bottom: '-10%', left: '-5%',
        width: '50%', height: '60%',
        background: 'radial-gradient(ellipse 60% 50% at 40% 60%, rgba(16,185,129,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* Subtle geometric pattern overlay (top-right) */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '45%', height: '60%',
        opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5L55 17.5V42.5L30 55L5 42.5V17.5L30 5Z' fill='none' stroke='%2310B981' stroke-width='0.5'/%3E%3C/svg%3E")`,
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
      }} />
      {/* Bottom gradient fade to white */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
        background: 'linear-gradient(to top, #FFFFFF 0%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* === CONTENT === */}
      <div className="container-lg hero-grid" style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 48,
        padding: '60px 24px 80px',
      }}>
        {/* LEFT — Text */}
        <div style={{
          flex: '0 0 45%', maxWidth: 520,
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateY(0)' : 'translateY(24px)',
          transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.15s',
        }}>
          <h1 style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)',
            fontWeight: 800, lineHeight: 1.1,
            color: C.dark, letterSpacing: '-0.03em',
            marginBottom: 24,
          }}>
            Идея <span style={{ color: C.primary }}>&rarr;</span> AI&#8209;видео
            <br />
            <span style={{ color: C.primary }}>&rarr;</span> публикация
            <br />
            за минуты
          </h1>

          <p style={{
            fontSize: '1.0625rem',
            color: C.gray500,
            lineHeight: 1.7, marginBottom: 36,
            maxWidth: 420,
          }}>
            Опишите идею, получите сценарий, озвучку
            и готовый ролик для VK, Telegram и других
            площадок — без сложного монтажа.
          </p>

          <div style={{
            display: 'flex', gap: 14, flexWrap: 'wrap',
          }}>
            <Link to="/login"><Btn variant="primary" size="lg">Начать бесплатно</Btn></Link>
            <a href="#how"><Btn variant="outline" size="lg">Посмотреть демо</Btn></a>
          </div>
        </div>

        {/* RIGHT — Product Mockup */}
        <div style={{
          flex: 1, minWidth: 0,
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateY(0) scale(1)' : 'translateY(32px) scale(0.97)',
          transition: 'all 0.9s cubic-bezier(0.4, 0, 0.2, 1) 0.4s',
        }}>
          <ProductMockup />
        </div>
      </div>
    </section>
  );
}

function ProductMockup() {
  return (
    <div style={{
      position: 'relative',
      borderRadius: 20,
      background: C.white,
      border: `1px solid ${C.gray200}`,
      boxShadow: '0 20px 60px rgba(10,31,22,0.08), 0 8px 24px rgba(10,31,22,0.04)',
      overflow: 'hidden',
    }}>
      {/* Window chrome */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 18px',
        background: C.bg,
        borderBottom: `1px solid ${C.gray200}`,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map(c => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.8 }} />
          ))}
        </div>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <div style={{
            background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 8,
            padding: '4px 16px', fontSize: '0.6875rem', color: C.gray400,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.primary, opacity: 0.6 }} />
            ai.videoai.ru/studio
          </div>
        </div>
        <div style={{ width: 48 }} />
      </div>

      {/* Product UI — 3-column layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr 200px',
        minHeight: 360,
      }}>
        {/* LEFT PANEL — Prompt */}
        <div style={{
          borderRight: `1px solid ${C.gray100}`,
          padding: 16,
          display: 'flex', flexDirection: 'column', gap: 14,
          background: C.offWhite,
        }}>
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: C.primary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={12} /> Prompt Panel
            </div>
            <div style={{
              background: C.white, borderRadius: 10,
              padding: 12, fontSize: '0.75rem',
              color: C.gray600, lineHeight: 1.5,
              border: `1px solid ${C.gray200}`,
              minHeight: 56,
            }}>
              Ролик о запуске кроссовок в futuristic city
            </div>
          </div>

          {/* Generate button */}
          <div style={{
            padding: '10px 16px', borderRadius: 10,
            background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
            color: C.white, fontSize: '0.75rem', fontWeight: 600,
            textAlign: 'center', cursor: 'default',
            boxShadow: '0 2px 8px rgba(16,185,129,0.25)',
          }}>
            Генерация...
          </div>

          {/* Generated images */}
          <div>
            <div style={{ fontSize: '0.625rem', fontWeight: 600, color: C.gray400, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Generated scenes
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                `linear-gradient(135deg, #1a3a2a 0%, #0d2b1e 50%, rgba(16,185,129,0.3) 100%)`,
                `linear-gradient(135deg, #2a1a3a 0%, #1e0d2b 50%, rgba(129,16,185,0.3) 100%)`,
                `linear-gradient(135deg, #3a2a1a 0%, #2b1e0d 50%, rgba(185,129,16,0.3) 100%)`,
                `linear-gradient(135deg, #1a2a3a 0%, #0d1e2b 50%, rgba(16,129,185,0.3) 100%)`,
              ].map((bg, i) => (
                <div key={i} style={{
                  height: 52, borderRadius: 8,
                  background: bg,
                  border: i === 0 ? `2px solid ${C.primary}` : `1px solid ${C.gray200}`,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {i === 0 && (
                    <div style={{
                      position: 'absolute', top: 3, right: 3,
                      width: 14, height: 14, borderRadius: 4,
                      background: C.primary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={8} color={C.white} strokeWidth={3} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER — Video Preview */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: C.dark, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Film size={12} /> Генерация...
          </div>
          <div style={{
            flex: 1, borderRadius: 14,
            background: 'linear-gradient(145deg, #0F2E21 0%, #0A1F16 60%, #0D2B1E 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
            minHeight: 220,
          }}>
            {/* Cinematic scene preview */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(circle at 50% 45%, rgba(16,185,129,0.12) 0%, transparent 60%)',
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(circle at 30% 70%, rgba(185,129,16,0.08) 0%, transparent 50%)',
            }} />
            {/* City silhouette placeholder */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
              background: 'linear-gradient(to top, rgba(16,185,129,0.08), transparent)',
            }} />
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            }}>
              <Play size={22} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
            </div>
            {/* Duration badge */}
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(0,0,0,0.4)', borderRadius: 6,
              padding: '3px 8px', fontSize: '0.5625rem', color: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(8px)',
            }}>
              00:30
            </div>
          </div>

          {/* Scene timeline */}
          <div style={{ display: 'flex', gap: 6 }}>
            {['Сцена 1', 'Сцена 2', 'Сцена 3', 'Сцена 4', 'Сцена 5'].map((s, i) => (
              <div key={i} style={{
                flex: 1, height: 40, borderRadius: 8,
                background: i === 0
                  ? `linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))`
                  : i < 3 ? C.gray100 : C.offWhite,
                border: i === 0 ? `1.5px solid ${C.primary}` : `1px solid ${C.gray200}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.5625rem', color: i === 0 ? C.primary : C.gray400, fontWeight: 600,
              }}>{s}</div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL — Voiceover + Export */}
        <div className="mockup-right" style={{
          borderLeft: `1px solid ${C.gray100}`,
          padding: 16,
          display: 'flex', flexDirection: 'column', gap: 14,
          background: C.offWhite,
        }}>
          {/* Voiceover */}
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: C.dark, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Volume2 size={12} /> Voiceover
            </div>
            {[
              { name: 'Татьяна', active: true },
              { name: 'Максим', active: false },
            ].map((v, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 8, marginBottom: 6,
                background: v.active ? C.primaryLight : C.white,
                border: `1px solid ${v.active ? 'rgba(16,185,129,0.2)' : C.gray200}`,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: v.active ? C.primary : C.gray300,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Mic size={12} color={C.white} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: C.dark }}>{v.name}</div>
                </div>
                {/* Waveform placeholder */}
                <div style={{ display: 'flex', gap: 1.5, alignItems: 'center', height: 16 }}>
                  {[4,8,12,6,10,14,8,5,11,7,13,9,6,10,8].map((h, j) => (
                    <div key={j} style={{
                      width: 2, height: h, borderRadius: 1,
                      background: v.active ? C.primary : C.gray300,
                      opacity: v.active ? 0.7 : 0.4,
                    }} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Export */}
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: C.dark, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={12} /> Export
            </div>
            {/* Social icons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'VK', bg: '#0077FF' },
                { label: 'TG', bg: '#26A5E4' },
                { label: 'MP4', bg: C.gray600 },
              ].map((s, i) => (
                <div key={i} style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: s.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.5625rem', fontWeight: 700, color: C.white,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                }}>
                  {s.label}
                </div>
              ))}
            </div>
            {/* Publish button */}
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
              color: C.white, fontSize: '0.6875rem', fontWeight: 600,
              textAlign: 'center',
              boxShadow: '0 2px 10px rgba(16,185,129,0.3)',
            }}>
              Опубликовать
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====== HOW IT WORKS — CARD STYLE ====== */
function HowItWorks() {
  const steps = [
    { num: '1', icon: MessageSquare, title: 'Идея', desc: 'Введите тему текстом или выберите один из готовых шаблонов — AI предложит 3 варианта сценария.' },
    { num: '2', icon: Wand2, title: 'Генерация AI', desc: 'Генерация визуала, озвучка голосом и автоматический монтаж — всё за пару минут.' },
    { num: '3', icon: Send, title: 'Публикация', desc: 'Одной кнопкой в VK, Telegram и MAX — или скачайте готовый файл на устройство.' },
  ];

  return (
    <section id="how" className="section" style={{ background: C.white }}>
      <div className="container">
        <Reveal>
          <h2 className="section-title">Как это работает</h2>
          <p className="section-subtitle">Три шага от идеи до публикации — без навыков монтажа</p>
        </Reveal>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
        }}>
          {steps.map((s, i) => (
            <Reveal key={s.num} delay={i + 1}>
              <div style={{
                background: C.white,
                border: `1px solid ${C.gray200}`,
                borderRadius: 20,
                padding: '32px 28px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                height: '100%',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  background: i === 0 ? C.primaryLight : C.gray100,
                  border: `1px solid ${i === 0 ? 'rgba(16,185,129,0.15)' : C.gray200}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20,
                }}>
                  <s.icon size={24} color={i === 0 ? C.primary : C.gray500} strokeWidth={1.8} />
                </div>

                <h3 style={{
                  fontSize: '1.15rem', marginBottom: 10, fontWeight: 700, color: C.dark,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ color: C.primary, fontSize: '0.875rem', fontWeight: 800 }}>{s.num}.</span>
                  {s.title}
                </h3>
                <p style={{ color: C.gray500, fontSize: '0.9375rem', lineHeight: 1.65 }}>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ====== FEATURES — BENTO GRID ====== */
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
          {/* Large: AI Scenarios */}
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

          {/* Small: Templates */}
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

          {/* Small: TTS */}
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

          {/* Medium: Publish */}
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

          {/* Medium: Speed */}
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

          {/* Wide: Russian stack */}
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

/* ====== PRICING ====== */
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

/* ====== FAQ ====== */
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

/* ====== FINAL CTA ====== */
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
