import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const YM_COUNTER_ID = 109958383;

export default function YandexMetrika() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window.ym === 'function') {
      window.ym(YM_COUNTER_ID, 'hit', location.pathname + location.search);
    }
  }, [location]);

  return null;
}
