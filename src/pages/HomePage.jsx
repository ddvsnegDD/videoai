// src/pages/HomePage.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, Play, Check, Plus, Clock, Type, Globe, AlertTriangle, Sparkles,
} from 'lucide-react';
import { C } from '../lib/theme';
import { PACKAGES } from '../data/tariffs';

/**
 * Публичный лендинг VideoAI (B2B-движок видеокреативов для маркетплейсов).
 * Демо-ролики кладём в public/demo/clip1.mp4 … clip3.mp4 (вертикальные 9:16).
 */
const CLIPS = {
  one: '/demo/clip1.mp4',
  two: '/demo/clip2.mp4',
  three: '/demo/clip3.mp4',
};

const ink = '#0A1F16';
const body = '#46594F';
const muted = '#6B7F74';
const line = '#E2EAE6';
const glass = 'rgba(255,255,255,0.72)';
const grad = `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`;

const gradText = {
  background: `linear-gradient(120deg, ${C.primary}, ${C.primaryDark})`,
  WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
};

/* ============================ Хедер ============================ */
function LandingHeader() {
  const nav = [
    ['Возможности', '#features'], ['Как это работает', '#how'],
    ['Тарифы', '#pricing'], ['FAQ', '#faq'],
  ];
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(247,250,248,0.78)', backdropFilter: 'blur(16px)', borderBottom: `1px solid ${line}` }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: grad, display: 'grid', placeItems: 'center', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
            <Play size={14} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
          </div>
          <span style={{ fontFamily: '"Manrope", sans-serif', fontWeight: 800, fontSize: 19, color: ink, letterSpacing: '-0.02em' }}>VideoAI</span>
        </div>
        <nav style={{ display: 'flex', gap: 30 }} className="vai-nav">
          {nav.map(([label, href]) => (
            <a key={href} href={href} style={{ fontSize: 14.5, color: body, textDecoration: 'none', fontWeight: 500 }}>{label}</a>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/login" style={{ fontSize: 14.5, color: body, textDecoration: 'none', fontWeight: 600 }}>Войти</Link>
          <Link to="/editor" style={{ background: grad, color: '#fff', textDecoration: 'none', padding: '10px 18px', borderRadius: 10, fontSize: 14.5, fontWeight: 700, boxShadow: '0 6px 16px rgba(16,185,129,0.28)' }}>Попробовать</Link>
        </div>
      </div>
    </header>
  );
}

/* ===================== Слайдер «До → После» ===================== */
function BeforeAfter() {
  const [pos, setPos] = useState(46);
  const wrap = useRef(null);
  const before = useRef(null);
  const after = useRef(null);
  const dragging = useRef(false);

  useEffect(() => {
    const v = before.current;
    if (v) { const f = () => { try { v.currentTime = 0.05; } catch (e) {} }; v.addEventListener('loadeddata', f); }
    if (after.current) after.current.play().catch(() => {});
  }, []);

  const move = (x) => {
    const r = wrap.current.getBoundingClientRect();
    setPos(Math.max(2, Math.min(98, ((x - r.left) / r.width) * 100)));
  };
  useEffect(() => {
    const mv = (e) => dragging.current && move(e.clientX ?? e.touches?.[0]?.clientX);
    const up = () => { dragging.current = false; };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', mv, { passive: true }); window.addEventListener('touchend', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); window.removeEventListener('touchmove', mv); window.removeEventListener('touchend', up); };
  }, []);

  const chip = (text, side, dark) => (
    <div style={{ position: 'absolute', bottom: 12, [side]: 12, zIndex: 4, background: dark ? 'rgba(10,31,22,0.74)' : 'rgba(255,255,255,0.82)', color: dark ? '#fff' : ink, backdropFilter: 'blur(6px)', padding: '5px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600 }}>{text}</div>
  );

  return (
    <div>
      <div ref={wrap}
        onMouseDown={(e) => { dragging.current = true; move(e.clientX); }}
        onTouchStart={(e) => { dragging.current = true; move(e.touches[0].clientX); }}
        style={{ position: 'relative', width: '100%', maxWidth: 286, margin: '0 auto', aspectRatio: '9 / 16', borderRadius: 16, overflow: 'hidden', background: '#0a1f16', cursor: 'ew-resize', userSelect: 'none', boxShadow: '0 20px 50px rgba(10,46,31,0.22)' }}>
        <video ref={after} src={CLIPS.one} autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        {chip(<><Sparkles size={11} style={{ verticalAlign: -1 }} /> Оживление · Kling 2.5</>, 'right', true)}
        <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - pos}% 0 0)`, zIndex: 2 }}>
          <video ref={before} src={CLIPS.one} muted playsInline preload="auto" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.5) contrast(0.9) brightness(1.14)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(244,247,245,0.22)' }} />
          {chip('Обычное фото', 'left', false)}
        </div>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos}%`, width: 2, background: 'rgba(255,255,255,0.92)', zIndex: 5, transform: 'translateX(-1px)' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 34, height: 34, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 4px 14px rgba(10,31,22,0.28)', color: C.primaryDark, fontSize: 13, fontWeight: 800 }}>⇄</div>
        </div>
      </div>
      <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12.5, color: muted }}>Двигайте ползунок — текст на упаковке не искажается при движении камеры</p>
    </div>
  );
}

function TextToImage() {
  const v = useRef(null);
  useEffect(() => { if (v.current) v.current.play().catch(() => {}); }, []);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: '#F4F7F5', border: `1px dashed ${line}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 300 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: muted, textTransform: 'uppercase', marginBottom: 8 }}>Ваше описание</div>
          <div style={{ fontSize: 13.5, color: ink, lineHeight: 1.5 }}>«Крем для лица в стеклянной баночке, мягкий студийный свет, веточка эвкалипта, бежевый фон»</div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.primaryDark }}>Nano Banana 2 →</div>
        </div>
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', minHeight: 300, background: '#0a1f16' }}>
          <video ref={v} src={CLIPS.two} autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 10, background: '#FFF4E8', border: '1px solid #FBD9AE', borderRadius: 10, padding: '10px 12px' }}>
        <AlertTriangle size={16} color="#C77D2B" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12.5, color: '#8A5A18', lineHeight: 1.45 }}>Нейросеть создаёт концепт-иллюстрацию <b>по описанию</b>, а не точную копию вашего товара. Для конкретного товара — загрузите фото.</span>
      </div>
    </div>
  );
}

function ModeCompare() {
  const Card = ({ tag, tagColor, name, lines, highlight }) => (
    <div style={{ flex: 1, background: '#fff', borderRadius: 14, padding: 16, border: highlight ? '1.5px solid #6366F1' : `1px solid ${line}`, boxShadow: highlight ? '0 10px 28px rgba(99,102,241,0.12)' : 'none' }}>
      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', color: tagColor, textTransform: 'uppercase' }}>{tag}</span>
      <h4 style={{ margin: '6px 0 10px', fontSize: 16, fontFamily: '"Manrope", sans-serif', color: ink }}>{name}</h4>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {lines.map((l, i) => <li key={i} style={{ fontSize: 12.5, color: body, display: 'flex', gap: 7, lineHeight: 1.35 }}><span style={{ color: highlight ? '#6366F1' : C.primary, fontWeight: 700 }}>·</span>{l}</li>)}
      </ul>
    </div>
  );
  return (
    <div style={{ minHeight: 332, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flex: 1 }}>
        <Card tag="Эконом" tagColor={C.primaryDark} name="Kling 2.5 turbo" lines={['Клип 5 секунд', 'Сверхстабильный текст', 'Готово за ~1 минуту', 'Рабочая лошадка для потока']} />
        <Card tag="Премиум" tagColor="#6366F1" name="Veo 3.1 fast" highlight lines={['Клип 8 секунд, 9:16', 'Кинематографичный свет', 'Глубина резкости, наезд', 'Для топовых карточек']} />
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: muted, background: '#F4F7F5', padding: 9, borderRadius: 8 }}>На старте — по 1 бесплатной попытке в каждом режиме</div>
    </div>
  );
}

function HeroWidget() {
  const [tab, setTab] = useState('photo');
  const tabs = [['photo', 'Фото → Видео'], ['text', 'Текст → Иллюстрация'], ['modes', 'Kling vs Veo']];
  return (
    <div style={{ background: glass, backdropFilter: 'blur(22px)', border: '1px solid rgba(16,185,129,0.16)', borderRadius: 22, padding: 18, boxShadow: '0 30px 70px rgba(10,46,31,0.12)' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'rgba(255,255,255,0.55)', padding: 4, borderRadius: 12, border: `1px solid ${line}` }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, border: 'none', cursor: 'pointer', borderRadius: 9, padding: '8px 6px', fontSize: 12.5, fontWeight: 600, background: tab === id ? '#fff' : 'transparent', color: tab === id ? ink : muted, boxShadow: tab === id ? '0 2px 8px rgba(10,46,31,0.08)' : 'none', transition: 'all .18s' }}>{label}</button>
        ))}
      </div>
      {tab === 'photo' && <BeforeAfter />}
      {tab === 'text' && <TextToImage />}
      {tab === 'modes' && <ModeCompare />}
    </div>
  );
}

/* ============================ Hero ============================ */
function Hero() {
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '52px 28px 28px' }}>
      <div className="vai-hero-grid" style={{ display: 'grid', gridTemplateColumns: '0.96fr 1.04fr', gap: 52, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.primaryLight, color: C.primaryDark, padding: '6px 13px', borderRadius: 100, fontSize: 12.5, fontWeight: 700, marginBottom: 22 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.primary }} /> B2B-движок креативов для маркетплейсов
          </div>
          <h1 style={{ fontFamily: '"Manrope", sans-serif', fontWeight: 800, fontSize: 50, lineHeight: 1.08, letterSpacing: '-0.025em', color: ink, margin: 0 }}>
            Превратите фото товара в <span style={gradText}>рекламный клип</span> за 1 минуту
          </h1>
          <p style={{ fontSize: 17.5, color: body, lineHeight: 1.55, margin: '22px 0 0', maxWidth: 480 }}>
            Платформа для селлеров WB и Ozon. Оживляем фото товара в ролик 5–8 секунд дешевле и быстрее подрядчика — текст на упаковке не плывёт.
          </p>
          <div style={{ display: 'flex', gap: 14, marginTop: 32, flexWrap: 'wrap' }}>
            <Link to="/editor" style={{ background: grad, color: '#fff', textDecoration: 'none', padding: '15px 28px', borderRadius: 12, fontSize: 16, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 9, boxShadow: '0 10px 26px rgba(16,185,129,0.32)' }}>Попробовать бесплатно <Zap size={16} /></Link>
            <a href="#pricing" style={{ background: 'rgba(255,255,255,0.7)', color: ink, textDecoration: 'none', border: `1px solid ${line}`, padding: '15px 26px', borderRadius: 12, fontSize: 16, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>Посмотреть пакеты</a>
          </div>
          <p style={{ fontSize: 13, color: muted, margin: '14px 0 30px' }}>Без карты · 1 ролик Kling + 1 ролик Veo бесплатно</p>
          <MarketMarks />
        </div>
        <div><HeroWidget /></div>
      </div>
    </section>
  );
}

function MarketMarks() {
  const mark = (label, color) => <span style={{ fontWeight: 800, fontSize: 15, color, letterSpacing: '-0.01em', fontFamily: '"Manrope", sans-serif' }}>{label}</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: muted, textTransform: 'uppercase' }}>Адаптировано под</span>
      {mark('Wildberries', '#A23CF0')}
      {mark('OZON', '#0A5BFF')}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{mark('Я', '#FC3F1D')}{mark('Маркет', ink)}</span>
    </div>
  );
}

/* ===================== Метрики / Шаги / Экономика ===================== */
function SectionHead({ eyebrow, title, subtitle, align = 'center' }) {
  return (
    <div style={{ textAlign: align, maxWidth: align === 'center' ? 640 : 'none', margin: align === 'center' ? '0 auto' : 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.primary, marginBottom: 12 }}>{eyebrow}</div>
      <h2 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 34, fontWeight: 800, color: ink, margin: 0, letterSpacing: '-0.025em', lineHeight: 1.15 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 16.5, color: body, margin: '14px auto 0', lineHeight: 1.5, maxWidth: 520 }}>{subtitle}</p>}
    </div>
  );
}

function Metrics() {
  const items = [
    ['< 2 мин', 'Среднее время сборки готового клипа', Clock],
    ['0%', 'Искажения текста — пресеты движения без ротации', Type],
    ['100%', 'Доступность из РФ: рубли, без VPN', Globe],
  ];
  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 28px 64px' }}>
      <div className="vai-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
        {items.map(([big, small, Icon]) => (
          <div key={big} style={{ background: glass, backdropFilter: 'blur(16px)', border: '1px solid rgba(16,185,129,0.16)', borderRadius: 16, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 18, boxShadow: '0 2px 10px rgba(10,46,31,0.05)' }}>
            <div style={{ fontSize: 34, fontWeight: 800, fontFamily: '"Manrope", sans-serif', color: C.primaryDark, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{big}</div>
            <div style={{ fontSize: 13.5, color: body, lineHeight: 1.4 }}>{small}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ['01', 'Загрузите фото товара', 'Или опишите словами — Nano Banana 2 сгенерирует концепт-иллюстрацию.', Plus],
    ['02', 'Выберите движение', 'Наезд, панорама, игра света — стабильные пресеты, которые берегут текст и логотип.', Play],
    ['03', 'Скачайте MP4', 'Через 1–2 минуты забираете готовый креатив 9:16 или 3:4 для карточки и соцсетей.', Zap],
  ];
  return (
    <section id="how" style={{ background: '#fff', borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}` }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 28px' }}>
        <SectionHead eyebrow="Как это работает" title="Три простых шага к готовому креативу" />
        <div className="vai-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22, marginTop: 44 }}>
          {steps.map(([n, title, desc, Icon]) => (
            <div key={n} style={{ position: 'relative', background: '#F8FBF9', border: `1px solid ${line}`, borderRadius: 18, padding: 30 }}>
              <div style={{ position: 'absolute', top: 24, right: 26, fontSize: 13, fontWeight: 800, color: line, fontFamily: '"Manrope", sans-serif' }}>{n}</div>
              <div style={{ width: 50, height: 50, borderRadius: 13, background: C.primaryLight, display: 'grid', placeItems: 'center', color: C.primaryDark, marginBottom: 18 }}><Icon size={22} /></div>
              <h3 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 19, fontWeight: 700, color: ink, margin: '0 0 8px' }}>{title}</h3>
              <p style={{ fontSize: 14.5, color: body, lineHeight: 1.55, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Economics() {
  const rows = [
    ['Стоимость ролика', 'от 3 000 ₽', 'от 6 ₽'],
    ['Срок', '2–3 дня', '~1 минута'],
    ['Правки и A/B-тесты', 'платно, долго', 'мгновенно'],
    ['Оператор и студия', 'обязательно', 'не нужны'],
  ];
  const Cell = ({ children, head, mut, accent, label }) => (
    <div style={{ padding: '12px 12px', borderBottom: `1px solid ${line}`, fontSize: head ? 12 : 14.5, fontWeight: head ? 700 : (label ? 600 : 500), textTransform: head ? 'uppercase' : 'none', letterSpacing: head ? '0.04em' : 0, color: accent ? C.primaryDark : (mut ? muted : ink), background: accent ? 'rgba(16,185,129,0.06)' : 'transparent', textAlign: head && !label ? 'center' : 'left' }}>{children}</div>
  );
  return (
    <section id="features" style={{ maxWidth: 1200, margin: '0 auto', padding: '76px 28px' }}>
      <div className="vai-eco-grid" style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: 48, alignItems: 'center' }}>
        <div>
          <SectionHead align="left" eyebrow="Зачем это селлеру" title="Останавливайте скролл и поднимайте конверсию карточки" />
          <ul style={{ listStyle: 'none', padding: 0, margin: '26px 0 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {['Видео в карточке держит внимание лучше статичного фото', 'Тестируйте 5 креативов там, где раньше делали один', 'Текст и логотип на упаковке остаются читаемыми', 'Свежие ролики под акции и сезон — за минуты'].map(li => (
              <li key={li} style={{ display: 'flex', gap: 12, fontSize: 15.5, color: body, lineHeight: 1.45 }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, background: C.primaryLight, color: C.primaryDark, display: 'grid', placeItems: 'center' }}><Check size={13} /></span>{li}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ background: glass, backdropFilter: 'blur(18px)', border: '1px solid rgba(16,185,129,0.16)', borderRadius: 20, padding: 30, boxShadow: '0 16px 40px rgba(10,46,31,0.07)' }}>
          <h3 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 19, fontWeight: 700, color: ink, margin: '0 0 20px' }}>Честная экономика</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr' }}>
            <Cell head /><Cell head mut>Студия / подрядчик</Cell><Cell head accent>VideoAI</Cell>
            {rows.map((r, i) => (
              <React.Fragment key={i}><Cell label>{r[0]}</Cell><Cell mut>{r[1]}</Cell><Cell accent>{r[2]}</Cell></React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================ Тарифы ============================ */
function Pricing() {
  return (
    <section id="pricing" style={{ background: '#fff', borderTop: `1px solid ${line}` }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '76px 28px' }}>
        <SectionHead eyebrow="Тарифы" title="Простые пакетные тарифы" subtitle="Платите за готовые ролики. Оплата в рублях через ЮMoney, кредиты не сгорают" />
        <div className="vai-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22, marginTop: 46, alignItems: 'stretch' }}>
          {PACKAGES.map(p => {
            const pop = !!p.popular;
            return (
              <div key={p.id} style={{ position: 'relative', borderRadius: 20, padding: '32px 28px', display: 'flex', flexDirection: 'column', background: pop ? 'linear-gradient(160deg, #0D2B1E, #0A1F16)' : '#F8FBF9', border: pop ? '1px solid rgba(16,185,129,0.3)' : `1px solid ${line}`, boxShadow: pop ? '0 24px 60px rgba(10,46,31,0.22)' : 'none', transform: pop ? 'translateY(-8px)' : 'none' }}>
                {pop && <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: grad, color: '#fff', padding: '5px 16px', borderRadius: 100, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>Популярный</div>}
                <div style={{ color: pop ? '#fff' : ink }}>
                  <h3 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 21, fontWeight: 800, margin: 0 }}>{p.title}</h3>
                  <p style={{ fontSize: 13.5, color: pop ? 'rgba(255,255,255,0.55)' : muted, margin: '4px 0 0' }}>{p.subtitle}</p>
                </div>
                <div style={{ margin: '22px 0 24px', display: 'flex', alignItems: 'baseline', gap: 7, color: pop ? '#fff' : ink }}>
                  <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em' }}>{p.price.toLocaleString('ru-RU')}</span>
                  <span style={{ fontSize: 14, color: pop ? 'rgba(255,255,255,0.5)' : muted, fontWeight: 500 }}>₽ разово</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  {p.feats.map(f => (
                    <li key={f} style={{ display: 'flex', gap: 11, fontSize: 14.5, color: pop ? 'rgba(255,255,255,0.82)' : body, lineHeight: 1.4 }}>
                      <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 6, background: pop ? 'rgba(16,185,129,0.2)' : C.primaryLight, color: C.primary, display: 'grid', placeItems: 'center' }}><Check size={12} /></span>{f}
                    </li>
                  ))}
                </ul>
                <Link to="/billing" style={{ textAlign: 'center', textDecoration: 'none', padding: 13, borderRadius: 11, fontSize: 15, fontWeight: 700, background: pop ? grad : 'transparent', color: pop ? '#fff' : C.primaryDark, border: pop ? 'none' : `1.5px solid ${C.primary}`, boxShadow: pop ? '0 8px 20px rgba(16,185,129,0.3)' : 'none' }}>{pop ? 'Оплатить пакет' : 'Купить пакет'}</Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================ FAQ ============================ */
function FAQ() {
  const qa = [
    ['Работает из России без VPN? Можно платить рублями?', 'Да. Сервис доступен из РФ напрямую, оплата в рублях. VPN не нужен.'],
    ['Сохранится ли текст и логотип на упаковке?', 'Да — это наш фокус. Пресеты движения без вращения берегут читаемость: при наезде и панораме текст не плывёт. Для сложных текстовых товаров есть премиум-режим Veo.'],
    ['Какие форматы на выходе?', 'Вертикальный 9:16 для соцсетей и 3:4 для карточек Wildberries и Ozon. Готовый файл — MP4.'],
    ['Чем Премиум (Veo) отличается от Эконома (Kling)?', 'Эконом (Kling 2.5) — 5 секунд, максимально стабильный текст, ~1 минута. Премиум (Veo 3.1) — 8 секунд, кинематографичный свет, боке и глубина резкости.'],
    ['Что если у меня нет хорошего фото товара?', 'Опишите товар словами — Nano Banana 2 создаст концепт-иллюстрацию по описанию, которую затем можно оживить.'],
  ];
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" style={{ maxWidth: 800, margin: '0 auto', padding: '76px 28px' }}>
      <SectionHead eyebrow="FAQ" title="Частые вопросы" />
      <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {qa.map(([q, a], i) => (
          <div key={i} style={{ background: glass, border: '1px solid rgba(16,185,129,0.16)', borderRadius: 14, overflow: 'hidden' }}>
            <button onClick={() => setOpen(open === i ? -1 : i)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, fontSize: 16, fontWeight: 600, color: ink }}>
              {q}
              <span style={{ flexShrink: 0, color: C.primary, fontSize: 20, transform: open === i ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }}>+</span>
            </button>
            {open === i && <div style={{ padding: '0 22px 20px', fontSize: 14.5, color: body, lineHeight: 1.6 }}>{a}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ===================== Финальный CTA + футер ===================== */
function FooterCTA() {
  return (
    <>
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 28px 76px' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 26, padding: '56px 48px', background: 'linear-gradient(135deg, #0D2B1E 0%, #0A1F16 100%)', boxShadow: '0 30px 70px rgba(10,46,31,0.28)' }}>
          <div aria-hidden style={{ position: 'absolute', top: -80, right: -40, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.28), transparent 70%)' }} />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 30, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontFamily: '"Manrope", sans-serif', fontSize: 32, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Первый креатив — бесплатно</h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', margin: '12px 0 0', maxWidth: 440 }}>Загрузите фото товара и заберите готовый клип уже через минуту. Без карты.</p>
            </div>
            <Link to="/editor" style={{ background: grad, color: '#fff', textDecoration: 'none', padding: '16px 32px', borderRadius: 12, fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 10px 28px rgba(16,185,129,0.4)' }}>Попробовать бесплатно</Link>
          </div>
        </div>
      </section>
    </>
  );
}

/* ============================ Страница ============================ */
export default function HomePage() {
  return (
    <div style={{ fontFamily: '"Inter", sans-serif', color: ink }}>
      <style>{`
        @media (max-width: 920px) {
          .vai-hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .vai-hero-grid h1 { font-size: 38px !important; }
          .vai-eco-grid { grid-template-columns: 1fr !important; gap: 30px !important; }
          .vai-3col { grid-template-columns: 1fr !important; }
          .vai-nav { display: none !important; }
        }
      `}</style>
      <LandingHeader />
      <Hero />
      <Metrics />
      <HowItWorks />
      <Economics />
      <Pricing />
      <FAQ />
      <FooterCTA />
    </div>
  );
}
