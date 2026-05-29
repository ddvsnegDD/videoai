export const TONES = [
  { key: 'cozy', label: 'Уютный', hint: 'тёплый, домашний, душевный, мягкие образы' },
  { key: 'energetic', label: 'Энергичный', hint: 'динамичный, молодёжный, драйвовый, быстрый монтаж' },
  { key: 'premium', label: 'Премиальный', hint: 'минималистичный, дорогой, стильный, лаконичный' },
];

export function buildScenarioPrompt({ topic, style, duration, tone }) {
  const dur = duration || 30;
  const styleHint = style && style !== 'Без предпочтений'
    ? `Желаемый стиль: ${style}.`
    : '';

  const system = `Ты — креативный сценарист коротких видео для соцсетей (Reels, VK Клипы, TikTok).

Твоя задача — придумать ОДИН проработанный сценарий в тоне "${tone.label}" (${tone.hint}).

Раз сценарий один — прорабатывай его ГЛУБОКО:
- 4-6 сцен, для каждой опиши: что показываем в кадре, что звучит за кадром или текстом на экране, настроение.
- Качество важнее краткости. Каждая сцена — полноценное описание на 1-2 предложения.

Сумма duration_sec всех сцен должна быть близка к ${dur} секунд (допуск ±2 сек).

Верни СТРОГО JSON одного объекта, без markdown-блоков, без вступления, без комментариев:
{"title": "...", "tone": "${tone.label}", "description": "...", "scenes": [{"description": "...", "duration_sec": N}, ...]}

Только валидный JSON. Русский язык, российские реалии.`;

  const user = `Тема видео: ${topic}
${styleHint}
Длительность: ${dur} секунд.
Тон: ${tone.label} — ${tone.hint}.

Придумай один проработанный сценарий.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user.trim() },
  ];
}
