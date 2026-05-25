import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Sparkles, Share2, Clock, ChevronDown, Check, Zap, Video, MessageSquare } from 'lucide-react';
import { C } from '../lib/theme.js';
import { tariffs } from '../data/tariffs.js';
import Btn from '../components/Btn.jsx';

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

function Hero() {
  return (
    <section style={{
      padding: '80px 0 64px',
      background: `linear-gradient(180deg, ${C.bg} 0%, #E8F5EE 100%)`,
      overflow: 'hidden',
    }}>
      <div className="container" style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: C.primaryLight,
          color: C.primaryDark,
          padding: '8px 16px',
          borderRadius: 100,
          fontSize: '0.875rem',
          fontWeight: 600,
          marginBottom: 24,
        }}>
          <Sparkles size={16} />
          Российский AI-стек
        </div>

        <h1 style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 800,
          lineHeight: 1.1,
          color: C.dark,
          marginBottom: 20,
          maxWidth: 720,
          margin: '0 auto 20px',
        }}>
          Идея → видео → публикация
          <br />
          <span style={{ color: C.primary }}>за 3 минуты</span>
        </h1>

        <p style={{
          fontSize: 'clamp(1rem, 2vw, 1.25rem)',
          color: C.gray500,
          maxWidth: 560,
          margin: '0 auto 40px',
          lineHeight: 1.6,
        }}>
          AI-помощник создаёт видеоролики для VK, Telegram и MAX.
          Опишите идею — получите готовый контент с озвучкой.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 48 }}>
          <Link to="/login"><Btn variant="primary" size="lg">Попробовать бесплатно</Btn></Link>
          <a href="#features"><Btn variant="outline" size="lg">Как это работает</Btn></a>
        </div>

        <div style={{
          maxWidth: 800,
          margin: '0 auto',
          borderRadius: 20,
          overflow: 'hidden',
          background: C.dark,
          aspectRatio: '16/9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          boxShadow: '0 24px 64px rgba(10, 46, 31, 0.2)',
        }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.2s ease',
          }}>
            <Play size={28} color={C.white} fill={C.white} style={{ marginLeft: 3 }} />
          </div>
          <div style={{
            position: 'absolute',
            bottom: 24,
            left: 24,
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.875rem',
          }}>
            Демо появится после Спринта 4
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { num: '01', icon: MessageSquare, title: 'Опишите идею', desc: 'Текстом или выберите готовый шаблон — AI предложит 3 варианта сценария' },
    { num: '02', icon: Video, title: 'AI создаёт видео', desc: 'Генерация визуала, озвучка и монтаж — всё автоматически за пару минут' },
    { num: '03', icon: Share2, title: 'Публикуйте', desc: 'Одной кнопкой в VK, Telegram и MAX — или скачайте файл' },
  ];

  return (
    <section id="features" className="section" style={{ background: C.white }}>
      <div className="container">
        <h2 className="section-title">Как это работает</h2>
        <p className="section-subtitle">От идеи до публикации — три простых шага</p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 32,
        }}>
          {steps.map((s) => (
            <div key={s.num} style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: C.primaryLight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <s.icon size={28} color={C.primary} />
              </div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: C.primary,
                marginBottom: 8,
                letterSpacing: '0.05em',
              }}>{s.num}</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: 8 }}>{s.title}</h3>
              <p style={{ color: C.gray500, fontSize: '0.9375rem', lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: Sparkles,
      title: 'Сценарии от AI',
      desc: 'GigaChat предложит 3 варианта сценария под вашу тему. Выбирайте лучший или редактируйте.',
    },
    {
      icon: Video,
      title: '5 шаблонов видео',
      desc: 'Анонс товара, цитата дня, до/после, сторителлинг, карусель фактов — под любой формат.',
    },
    {
      icon: Zap,
      title: 'Озвучка SpeechKit',
      desc: '4 голоса Яндекс SpeechKit. Мужские и женские, спокойные и эмоциональные.',
    },
    {
      icon: Share2,
      title: 'Публикация в 1 клик',
      desc: 'VK-группы, Telegram-каналы — подключите аккаунт и публикуйте прямо из кабинета.',
    },
    {
      icon: Clock,
      title: 'Готово за 3 минуты',
      desc: 'Описали идею — получили готовый ролик с озвучкой в формате 9:16 для сторис и Reels.',
    },
    {
      icon: Play,
      title: 'Российский стек',
      desc: 'Работает без VPN. GigaChat, Kandinsky, SpeechKit — всё доступно из РФ.',
    },
  ];

  return (
    <section className="section">
      <div className="container">
        <h2 className="section-title">Возможности</h2>
        <p className="section-subtitle">Всё для создания видео-контента в одном кабинете</p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
        }}>
          {features.map((f, i) => (
            <div key={i} className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: C.primaryLight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <f.icon size={22} color={C.primary} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.0625rem', marginBottom: 6 }}>{f.title}</h3>
                <p style={{ color: C.gray500, fontSize: '0.9375rem', lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="section" style={{ background: C.white }}>
      <div className="container">
        <h2 className="section-title">Тарифы</h2>
        <p className="section-subtitle">Начните бесплатно — масштабируйтесь по мере роста</p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          maxWidth: 960,
          margin: '0 auto',
        }}>
          {tariffs.map((t) => (
            <div key={t.id} className="card" style={{
              position: 'relative',
              border: t.popular ? `2px solid ${C.primary}` : `1px solid ${C.gray200}`,
              display: 'flex',
              flexDirection: 'column',
            }}>
              {t.popular && (
                <div style={{
                  position: 'absolute',
                  top: -13,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: C.primary,
                  color: C.white,
                  padding: '4px 16px',
                  borderRadius: 100,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>Популярный</div>
              )}

              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: 4 }}>{t.name}</h3>
                <p style={{ color: C.gray500, fontSize: '0.875rem' }}>{t.description}</p>
              </div>

              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: "'Manrope', sans-serif" }}>
                  {t.price === 0 ? '0' : t.price.toLocaleString('ru-RU')}
                </span>
                <span style={{ color: C.gray500, fontSize: '0.875rem', marginLeft: 4 }}>
                  {t.price === 0 ? 'кредитов' : '₽'}
                </span>
              </div>

              <ul style={{ listStyle: 'none', marginBottom: 32, flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {t.features.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9375rem' }}>
                    <Check size={18} color={C.primary} style={{ flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
                {t.limits.map((l, i) => (
                  <li key={`l${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9375rem', color: C.gray400 }}>
                    <span style={{ width: 18, textAlign: 'center', flexShrink: 0 }}>—</span>
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
                  {t.price === 0 ? 'Начать бесплатно' : 'Выбрать'}
                </Btn>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    {
      q: 'Какие форматы видео поддерживаются?',
      a: 'На старте — вертикальное видео 9:16 длительностью 15 и 30 секунд. Идеально для сторис VK, Telegram и коротких роликов.',
    },
    {
      q: 'Сколько стоит создание одного видео?',
      a: 'Зависит от шаблона. Простое видео с озвучкой — от 6 кредитов (~12 ₽). Видео с AI-генерацией визуала — от 20 кредитов (~40 ₽).',
    },
    {
      q: 'Можно ли использовать без VPN?',
      a: 'Да! VideoAI работает полностью на российском стеке: GigaChat, Kandinsky, Yandex SpeechKit. Никакие зарубежные API не нужны.',
    },
    {
      q: 'Как работает публикация в соцсети?',
      a: 'Подключаете VK-группу через OAuth или Telegram-канал через нашего бота. После этого публикуете видео в один клик прямо из кабинета.',
    },
    {
      q: 'Есть ли бесплатный тариф?',
      a: 'Да, при регистрации начисляем 30 кредитов — этого хватит на 2-3 видео с озвучкой, чтобы протестировать сервис.',
    },
  ];

  return (
    <section id="faq" className="section">
      <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h2 className="section-title">Частые вопросы</h2>
        <p className="section-subtitle">Не нашли ответ? Напишите нам</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((item, i) => (
            <FAQItem key={i} question={item.q} answer={item.a} />
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
      className="card"
      style={{ padding: '20px 24px', cursor: 'pointer' }}
      onClick={() => setOpen(!open)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{question}</h3>
        <ChevronDown
          size={20}
          color={C.gray400}
          style={{
            flexShrink: 0,
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
          }}
        />
      </div>
      {open && (
        <p style={{
          color: C.gray500,
          fontSize: '0.9375rem',
          lineHeight: 1.6,
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${C.gray200}`,
        }}>
          {answer}
        </p>
      )}
    </div>
  );
}

function CTA() {
  return (
    <section style={{
      padding: '80px 0',
      background: `linear-gradient(135deg, ${C.dark} 0%, #0D3D2A 100%)`,
    }}>
      <div className="container" style={{ textAlign: 'center' }}>
        <h2 style={{
          fontFamily: "'Manrope', sans-serif",
          fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
          fontWeight: 800,
          color: C.white,
          marginBottom: 16,
        }}>
          Готовы создать первое видео?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.125rem', marginBottom: 32, maxWidth: 480, margin: '0 auto 32px' }}>
          30 бесплатных кредитов при регистрации. Без привязки карты.
        </p>
        <Link to="/login">
          <Btn variant="primary" size="lg">Начать бесплатно</Btn>
        </Link>
      </div>
    </section>
  );
}
