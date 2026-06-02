// Source of truth for package prices and credit amounts.
// Backend reads this file directly — never trust price/credits from client.
export const PACKAGES = [
  // ── Economy (Kling) ──
  {
    id: 'economy_1',
    title: '1 ролик',
    subtitle: 'Попробовать',
    price: 199,
    credits: 40,
    kind: 'economy',
  },
  {
    id: 'economy_5',
    title: '5 роликов',
    subtitle: 'Оптимальный старт',
    price: 890,
    credits: 200,
    kind: 'economy',
    popular: true,
  },
  {
    id: 'economy_15',
    title: '15 роликов',
    subtitle: 'Для активной работы',
    price: 2390,
    credits: 600,
    kind: 'economy',
  },
  {
    id: 'economy_30',
    title: '30 роликов',
    subtitle: 'Максимальная выгода',
    price: 3990,
    credits: 1200,
    kind: 'economy',
  },
  // ── Premium (Veo) ──
  {
    id: 'premium_1',
    title: '1 премиум',
    subtitle: 'Кинематографичное качество',
    price: 590,
    credits: 90,
    kind: 'premium',
  },
  {
    id: 'premium_5',
    title: '5 премиум',
    subtitle: 'Серия премиум-роликов',
    price: 2490,
    credits: 450,
    kind: 'premium',
  },
];

// Quick lookup by id
export function getPackageById(id) {
  return PACKAGES.find(p => p.id === id) || null;
}

// Legacy export kept for backward compat (BillingPage used `tariffs`)
export const tariffs = PACKAGES;
