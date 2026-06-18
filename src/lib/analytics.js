const TMR_COUNTER_ID = '3773643';
const YM_COUNTER_ID = 109958383;

export function trackRegistration() {
  try {
    window._tmr = window._tmr || [];
    window._tmr.push({
      id: TMR_COUNTER_ID,
      type: 'reachGoal',
      goal: 'registration',
    });
  } catch (e) {
    console.warn('tmr track failed', e);
  }

  try {
    if (typeof window.ym === 'function') {
      window.ym(YM_COUNTER_ID, 'reachGoal', 'registration');
    }
  } catch (e) {
    console.warn('ym track failed', e);
  }
}
