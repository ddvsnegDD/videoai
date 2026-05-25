import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Play, Sparkles, Share2, ChevronDown, Check, Zap, Video,
  MessageSquare, Mic, Layout, Clock, Globe, ArrowRight,
  Wand2, Film, Send,
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

/* ====== HERO ====== */
function Hero() {
  return (
    <section style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${C.darkPine} 0%, ${C.dark} 70%)`,
      overflow: 'hidden',
      paddingTop: 72,
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: '140%', height: '60%',
        background: 'radial-gradient(ellipse, rgba(16,185,129,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 200,
        background: 'linear-gradient(to top, rgba(10,31,22,0.6), transparent)',
        pointerEvents: 'none',
      }} />

      <div className="container-lg" style={{ position: 'relative', zIndex: 2, padding: '60px 24px 48px' }}>
        <div style={{ textAlign: 'center', maxWidth: 800, margin: '0 auto', marginBottom: 56 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            color: C.primary,
            padding: '8px 18px', borderRadius: 100,
            fontSize: '0.8125rem', fontWeight: 600,
            marginBottom: 28, letterSpacing: '0.02em',
          }}>
            <Sparkles size={14} />
            AI-платформа для создания видео
          </div>

          <h1 style={{
            fontFamily: "'Manrope', sans-serif",
            fontSize: 'clamp(2.25rem, 5.5vw, 4rem)',
            fontWeight: 800, lineHeight: 1.08,
            color: C.white, letterSpacing: '-0.03em',
            marginBottom: 24,
          }}>
            От идеи до готового
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #10B981, #34D399)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>AI-видео</span> — за минуты
          </h1>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            color: 'rgba(255,255,255,0.55)',
            maxWidth: 540, margin: '0 auto 40px',
            lineHeight: 1.7,
          }}>
            Опишите идею, получите сценарий, озвучку и готовый ролик
            для VK, Telegram и других площадок — без сложного монтажа.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Link to="/login"><Btn variant="primary" size="lg">Начать бесплатно</Btn></Link>
            <a href="#how"><Btn variant="ghost" size="lg">Как это работает</Btn></a>
          </div>
        </div>

        {/* Product Mockup */}
        <ProductMockup />
      </div>
    </section>
  );
}

function ProductMockup() {
  return (
    <div style={{
      maxWidth: 960, margin: '0 auto',
      borderRadius: 20,
      background: 'rgba(17, 41, 34, 0.6)',
      border: '1px solid rgba(16, 185, 129, 0.12)',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 32px 80px rgba(0,0,0,0.3), 0 0 60px rgba(16,185,129,0.08)',
      overflow: 'hidden',
    }}>
      {/* Window chrome */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '14px 20px',
        background: 'rgba(10, 31, 22, 0.5)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', gap: 7 }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map(c => (
            <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c, opacity: 0.8 }} />
          ))}
        </div>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.3)', letterSpacing: '0.02em',
        }}>
          VideoAI — Редактор
        </div>
      </div>

      {/* Product UI */}
      <div style={{ padding: 24, display: 'flex', gap: 20, minHeight: 340 }}>
        {/* Left: prompt & templates */}
        <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.06)', padding: 16,
          }}>
            <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Промпт
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.06)', borderRadius: 10,
              padding: '12px 14px', fontSize: '0.8125rem',
              color: 'rgba(255,255,255,0.7)', lineHeight: 1.5,
              border: '1px solid rgba(16,185,129,0.15)',
            }}>
              Тыквенный латте, осень, уютная кофейня, аромат корицы ✨
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.06)', padding: 16,
          }}>
            <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Шаблон
            </div>
            {['Анонс товара', 'Сторителлинг', 'Цитата дня'].map((t, i) => (
              <div key={t} style={{
                padding: '9px 12px', borderRadius: 8, marginBottom: 6,
                fontSize: '0.8125rem', fontWeight: 500, cursor: 'default',
                background: i === 0 ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: i === 0 ? C.primary : 'rgba(255,255,255,0.45)',
                border: i === 0 ? `1px solid rgba(16,185,129,0.25)` : '1px solid transparent',
              }}>{t}</div>
            ))}
          </div>

          <div style={{
            display: 'flex', gap: 8, fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)',
          }}>
            {['9:16', '16:9', '1:1'].map((f, i) => (
              <div key={f} style={{
                padding: '6px 14px', borderRadius: 8,
                background: i === 0 ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                color: i === 0 ? C.primary : 'rgba(255,255,255,0.35)',
                border: `1px solid ${i === 0 ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`,
                fontWeight: 600, fontSize: '0.6875rem',
              }}>{f}</div>
            ))}
          </div>
        </div>

        {/* Center: preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            flex: 1, borderRadius: 14,
            background: 'linear-gradient(145deg, rgba(16,185,129,0.06) 0%, rgba(10,31,22,0.4) 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden', minHeight: 200,
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(circle at 50% 60%, rgba(16,185,129,0.08) 0%, transparent 60%)',
            }} />
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(16,185,129,0.2)', border: '2px solid rgba(16,185,129,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 32px rgba(16,185,129,0.2)',
            }}>
              <Play size={22} color={C.primary} fill={C.primary} style={{ marginLeft: 2 }} />
            </div>
            <div style={{
              position: 'absolute', bottom: 12, left: 14, right: 14,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.3)' }}>00:00 / 00:30</span>
              <div style={{
                flex: 1, height: 3, borderRadius: 2, margin: '0 12px',
                background: 'rgba(255,255,255,0.08)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: '65%',
                  borderRadius: 2,
                  background: `linear-gradient(90deg, ${C.primary}, ${C.primaryDark})`,
                }} />
              </div>
              <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.3)' }}>9:16</span>
            </div>
          </div>

          {/* Scene thumbnails */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{
                flex: 1, height: 48, borderRadius: 8,
                background: i === 1
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))'
                  : 'rgba(255,255,255,0.03)',
                border: i === 1 ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.625rem', color: 'rgba(255,255,255,0.25)', fontWeight: 600,
              }}>Сцена {i}</div>
            ))}
          </div>
        </div>

        {/* Right: status */}
        <div className="mockup-right" style={{ flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { icon: Wand2, label: 'Сценарий', status: 'Готов', done: true },
            { icon: Film, label: 'Визуал', status: 'Готов', done: true },
            { icon: Mic, label: 'Озвучка', status: 'Генерация...', done: false },
            { icon: Send, label: 'Публикация', status: 'Ожидание', done: false },
          ].map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 10,
              background: s.done ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${s.done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)'}`,
            }}>
              <s.icon size={15} color={s.done ? C.primary : 'rgba(255,255,255,0.25)'} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{s.label}</div>
                <div style={{
                  fontSize: '0.625rem',
                  color: s.done ? C.primary : 'rgba(255,255,255,0.3)',
                  fontWeight: 500,
                }}>{s.status}</div>
              </div>
              {s.done && <Check size={14} color={C.primary} />}
            </div>
          ))}

          <div style={{
            marginTop: 'auto', padding: '12px 14px', borderRadius: 10,
            background: `linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.05))`,
            border: '1px solid rgba(16,185,129,0.2)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.6875rem', color: C.primary, fontWeight: 600, marginBottom: 2 }}>Экспорт</div>
            <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.35)' }}>VK · Telegram · MP4</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====== HOW IT WORKS ====== */
function HowItWorks() {
  const steps = [
    { num: '01', icon: MessageSquare, title: 'Опишите идею', desc: 'Введите тему текстом или выберите один из готовых шаблонов — AI предложит 3 варианта сценария', accent: 'rgba(16,185,129,0.08)' },
    { num: '02', icon: Wand2, title: 'AI создаёт контент', desc: 'Генерация визуала, озвучка голосом и автоматический монтаж — всё за пару минут', accent: 'rgba(16,185,129,0.06)' },
    { num: '03', icon: Send, title: 'Публикуйте', desc: 'Одной кнопкой в VK, Telegram и MAX — или скачайте готовый файл на устройство', accent: 'rgba(16,185,129,0.04)' },
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
          gap: 24,
          position: 'relative',
        }}>
          {/* Connector line */}
          <div className="steps-connector" style={{
            position: 'absolute', top: 52, left: 'calc(16.66% + 24px)', right: 'calc(16.66% + 24px)',
            height: 2,
            background: `linear-gradient(90deg, ${C.primary}, rgba(16,185,129,0.2))`,
            borderRadius: 1,
            zIndex: 0,
          }} />

          {steps.map((s, i) => (
            <Reveal key={s.num} delay={i + 1}>
              <div style={{
                textAlign: 'center', padding: '0 16px',
                position: 'relative', zIndex: 1,
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 20,
                  background: C.white,
                  border: `2px solid ${i === 0 ? C.primary : C.gray200}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                  boxShadow: i === 0 ? `0 0 0 6px ${C.primaryGlow}` : C.shadowSm,
                  transition: 'all 0.3s ease',
                }}>
                  <s.icon size={28} color={i === 0 ? C.primary : C.gray500} strokeWidth={1.8} />
                </div>

                <div style={{
                  fontSize: '0.6875rem', fontWeight: 700, color: C.primary,
                  marginBottom: 10, letterSpacing: '0.08em',
                }}>{s.num}</div>

                <h3 style={{ fontSize: '1.2rem', marginBottom: 10, fontWeight: 700 }}>{s.title}</h3>
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
