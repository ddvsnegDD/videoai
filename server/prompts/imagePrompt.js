export function buildImagePrompt({ sceneDescription, tone, style }) {
  let prompt = sceneDescription;

  if (tone) {
    const toneHints = {
      'Уютный': 'тёплые мягкие тона, уютная атмосфера, мягкий свет',
      'Энергичный': 'яркие насыщенные цвета, динамичная композиция, контраст',
      'Премиальный': 'минимализм, приглушённые благородные тона, элегантность',
    };
    const hint = toneHints[tone];
    if (hint) prompt += `. Стиль: ${hint}`;
  }

  if (style && style !== 'Без предпочтений') {
    prompt += `. ${style}`;
  }

  prompt += '. Вертикальная композиция, без текста, без надписей, качественная иллюстрация';

  return prompt;
}
