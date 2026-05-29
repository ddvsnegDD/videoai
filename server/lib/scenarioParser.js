export function parseSingleScenario(rawText) {
  try {
    let text = rawText.trim();

    // Strip markdown code blocks
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    // Find first { and last }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return { ok: false, error: 'PARSE_ERROR' };
    }

    const json = text.substring(start, end + 1);
    const s = JSON.parse(json);

    if (!s.title || !s.description || !Array.isArray(s.scenes) || s.scenes.length < 2) {
      return { ok: false, error: 'PARSE_ERROR' };
    }

    const scenes = [];
    for (const sc of s.scenes) {
      if (!sc.description || typeof sc.duration_sec !== 'number') continue;
      scenes.push({
        description: String(sc.description),
        duration_sec: Math.round(sc.duration_sec),
      });
    }

    if (scenes.length < 2) {
      return { ok: false, error: 'PARSE_ERROR' };
    }

    return {
      ok: true,
      scenario: {
        title: String(s.title),
        tone: s.tone ? String(s.tone) : undefined,
        description: String(s.description),
        scenes,
      },
    };
  } catch {
    return { ok: false, error: 'PARSE_ERROR' };
  }
}

// Legacy — kept for backward compatibility, no longer used in main flow
export function parseScenariosResponse(rawText) {
  try {
    let text = rawText.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return { ok: false, error: 'PARSE_ERROR' };
    }

    const json = text.substring(start, end + 1);
    const data = JSON.parse(json);

    if (!Array.isArray(data.scenarios) || data.scenarios.length < 1) {
      return { ok: false, error: 'PARSE_ERROR' };
    }

    const validated = [];
    for (const s of data.scenarios.slice(0, 3)) {
      if (!s.title || !s.description || !Array.isArray(s.scenes) || s.scenes.length < 2) continue;
      const scenes = [];
      for (const sc of s.scenes) {
        if (!sc.description || typeof sc.duration_sec !== 'number') continue;
        scenes.push({ description: String(sc.description), duration_sec: Math.round(sc.duration_sec) });
      }
      if (scenes.length >= 2) {
        validated.push({ title: String(s.title), description: String(s.description), scenes });
      }
    }

    if (validated.length === 0) return { ok: false, error: 'PARSE_ERROR' };
    return { ok: true, scenarios: validated };
  } catch {
    return { ok: false, error: 'PARSE_ERROR' };
  }
}
