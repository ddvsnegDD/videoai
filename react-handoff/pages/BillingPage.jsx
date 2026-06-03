import React, { useState } from 'react';
import { Check, CreditCard, ShieldCheck, Zap, HelpCircle } from 'lucide-react';
import { C } from '../lib/theme'; // Твоя палитра из theme.js

export default function BillingPage() {
  const [selectedBillingType, setSelectedBillingType] = useState('packages'); // 'packages' | 'corporate'

  const S = {
    pageBg: 'linear-gradient(135deg, #EFF6F0 0%, #EBF3F5 50%, #F3EBF5 100%)',
    glassCard: (isPopular) => ({
      background: 'rgba(255, 255, 255, 0.75)',
      backdropFilter: 'blur(20px)',
      border: isPopular ? `2px solid ${C.primary}` : '1px solid rgba(16, 185, 129, 0.12)',
      borderRadius: '24px',
      padding: '32px 24px',
      boxShadow: isPopular ? '0 20px 40px rgba(10, 46, 31, 0.06)' : '0 12px 24px rgba(10, 46, 31, 0.02)',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      transition: 'transform 0.2s ease',
      transform: isPopular ? 'scale(1.03)' : 'scale(1)'
    }),
    badge: {
      position: 'absolute',
      top: '-12px',
      right: '24px',
      backgroundColor: C.primary,
      color: '#FFFFFF',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 700,
      boxShadow: '0 4px 10px rgba(16,185,129,0.2)'
    }
  };

  return (
    <div style={{ background: S.pageBg, minHeight: 'calc(100vh - 70px)', padding: '60px 20px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1140px', margin: '0 auto', textAlign: 'center' }}>
        
        {/* ЗАГОЛОВОК СТРАНИЦЫ */}
        <h1 style={{ fontFamily: '"Manrope", sans-serif', fontSize: '36px', fontWeight: 800, color: C.dark, marginBottom: '12px' }}>
          Выберите пакет видеокреативов
        </h1>
        <p style={{ fontSize: '16px', color: C.gray600, maxWidth: '600px', margin: '0 auto 40px auto', lineHeight: 1.5 }}>
          Покупайте готовые ролики для маркетплейсов. Оплата в рублях через ЮKassa, кредиты не сгорают и остаются на балансе навсегда.
        </p>

        {/* СЕТКА ТАРИФОВ (ТРЕХКОЛОНОЧНАЯ) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px', alignItems: 'stretch', marginBottom: '50px', textAlign: 'left' }}>
          
          {/* ТАРИФ 1: Hook Pack */}
          <div style={S.glassCard(false)}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: C.gray600, marginBottom: '8px' }}>Hook Pack</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '20px' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, color: C.dark }}>599 ₽</span>
              </div>
              <p style={{ fontSize: '13px', color: C.gray500, lineHeight: 1.4, marginBottom: '24px' }}>
                Идеально для тестирования воронки клипов и проверки CTR карточек товара.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: `1px solid ${C.gray200}`, paddingTop: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', fontSize: '14px', alignItems: 'center' }}><Check size={16} style={{ color: C.primary }} /> <span><strong>100 роликов</strong> (Kling 2.5 Эконом)</span></div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '14px', alignItems: 'center' }}><Check size={16} style={{ color: C.primary }} /> <span>Генерация картинок Nano Banana 2</span></div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '14px', alignItems: 'center' }}><Check size={16} style={{ color: C.primary }} /> <span>Выгрузка в S3 в формате MP4</span></div>
              </div>
            </div>
            <button style={{ width: '100%', border: `1px solid ${C.primary}`, color: C.primary, backgroundColor: 'transparent', padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, marginTop: '32px', cursor: 'pointer' }}>
              Купить пакет
            </button>
          </div>

          {/* ТАРИФ 2: Seller (ХИТ) */}
          <div style={S.glassCard(true)}>
            <div style={S.badge}>ПОПУЛЯРНО</div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: C.primaryDark, marginBottom: '8px' }}>Seller</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '20px' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, color: C.dark }}>1 599 ₽</span>
              </div>
              <p style={{ fontSize: '13px', color: C.gray500, lineHeight: 1.4, marginBottom: '24px' }}>
                Оптимальный объем для селлеров с широкой линейкой SKU и частыми поставками.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: `1px solid ${C.gray200}`, paddingTop: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', fontSize: '14px', alignItems: 'center' }}><Check size={16} style={{ color: C.primary }} /> <span><strong>300 роликов</strong> (Kling 2.5 Эконом)</span></div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '14px', alignItems: 'center' }}><Check size={16} style={{ color: C.primary }} /> <span>+5 Премиум-креативов (Veo 3.1)</span></div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '14px', alignItems: 'center' }}><Check size={16} style={{ color: C.primary }} /> <span>Приоритетная очередь на рендеринг</span></div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '14px', alignItems: 'center' }}><Check size={16} style={{ color: C.primary }} /> <span>Сохранение мелкого текста на упаковке</span></div>
              </div>
            </div>
            <button style={{ width: '100%', border: 'none', color: '#FFFFFF', backgroundColor: C.primary, padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, marginTop: '32px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(16,185,129,0.15)' }}>
              Оплатить пакет
            </button>
          </div>

          {/* ТАРИФ 3: Product Shots Pack */}
          <div style={S.glassCard(false)}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: C.gray600, marginBottom: '8px' }}>Product Shots Pack</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '20px' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, color: C.dark }}>1 099 ₽</span>
              </div>
              <p style={{ fontSize: '13px', color: C.gray500, lineHeight: 1.4, marginBottom: '24px' }}>
                Для продвинутых e-commerce команд, создающих масштабные рекламные кампании.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: `1px solid ${C.gray200}`, paddingTop: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', fontSize: '14px', alignItems: 'center' }}><Check size={16} style={{ color: C.primary }} /> <span><strong>200 роликов</strong> (Kling 2.5 Эконом)</span></div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '14px', alignItems: 'center' }}><Check size={16} style={{ color: C.primary }} /> <span>+2 Премиум-креативов (Veo 3.1)</span></div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '14px', alignItems: 'center' }}><Check size={16} style={{ color: C.primary }} /> <span>Техподдержка по подготовке карточек товаров</span></div>
              </div>
            </div>
            <button style={{ width: '100%', border: `1px solid ${C.primary}`, color: C.primary, backgroundColor: 'transparent', padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, marginTop: '32px', cursor: 'pointer' }}>
              Купить пакет
            </button>
          </div>

        </div>

        {/* БЛОК БЕЗОПАСНОСТИ И ГАРАНТИЙ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '760px', margin: '0 auto', textAlign: 'left' }}>
          <div style={{ display: 'flex', gap: '12px', background: 'rgba(255,255,255,0.4)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.03)' }}>
            <CreditCard style={{ color: C.primary, flexShrink: 0 }} size={20} />
            <div style={{ fontSize: '13px', lineHeight: 1.4, color: C.gray600 }}>
              <strong>Безопасная оплата ЮKassa.</strong> Все платежи шифруются. Мы не храним данные ваших банковских карт. Автоматическое выставление чеков.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', background: 'rgba(255,255,255,0.4)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.03)' }}>
            <ShieldCheck style={{ color: C.primary, flexShrink: 0 }} size={20} />
            <div style={{ fontSize: '13px', lineHeight: 1.4, color: C.gray600 }}>
              <strong>Закрывающие документы.</strong> Для юридических лиц доступна оплата по безналичному расчету с предоставлением актов через ЭДО.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}