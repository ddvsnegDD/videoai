// Source of truth for package prices and credit amounts.
// Backend reads this file directly — never trust price/credits from client.
export const PACKAGES = [
  {
    id: 'hook',
    title: 'Hook Pack',
    subtitle: '3 эконом-ролика для тестирования гипотез',
    price: 599,
    credits: 120,
    feats: [
      '3 эконом-ролика (Kling)',
      'Скачивание MP4',
      'Все пресеты движения',
      'Генерация картинки по тексту',
    ],
  },
  {
    id: 'product_shots',
    title: 'Product Shots',
    subtitle: '6 эконом-роликов или 2 премиум',
    price: 1099,
    credits: 240,
    feats: [
      '6 эконом-роликов (Kling)',
      'Или 2 премиум (Veo)',
      'Все пресеты движения',
      'Генерация картинки по тексту',
    ],
  },
  {
    id: 'seller',
    title: 'Seller',
    subtitle: '9 эконом-роликов или 4 премиум',
    price: 1599,
    credits: 360,
    popular: true,
    feats: [
      '9 эконом-роликов (Kling)',
      'Или 4 премиум (Veo)',
      'Лучшая цена за кредит',
      'Все возможности платформы',
    ],
  },
];

// Quick lookup by id
export function getPackageById(id) {
  return PACKAGES.find(p => p.id === id) || null;
}

// Export used by HomePage landing — keeps marketing card structure
export const tariffs = [
  {
    id: 'free',
    name: 'Пробный',
    price: 0,
    credits: 0,
    description: '1 бесплатный Kling + 1 Veo на старте',
    features: [
      '1 эконом-ролик (Kling) бесплатно',
      '1 премиум-ролик (Veo) бесплатно',
      'Скачивание MP4',
      'Все пресеты движения',
    ],
    limits: ['Без автопополнения'],
    popular: false,
  },
  {
    id: 'hook',
    name: 'Hook Pack',
    price: 599,
    credits: 120,
    description: '3 ролика для тестирования гипотез',
    features: [
      '3 эконом-ролика (Kling)',
      'Скачивание MP4',
      'Все пресеты движения',
      'Генерация картинки по тексту',
    ],
    limits: [],
    popular: false,
  },
  {
    id: 'seller',
    name: 'Seller',
    price: 1599,
    credits: 360,
    description: 'Полный комплект для селлера',
    features: [
      '9 эконом-роликов (Kling)',
      'Или 4 премиум (Veo)',
      'Лучшая цена за кредит',
      'Все возможности платформы',
    ],
    limits: [],
    popular: true,
  },
];
