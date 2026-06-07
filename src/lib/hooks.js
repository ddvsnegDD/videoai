import { useState, useEffect, useRef } from 'react';
import { api } from './api.js';

export function useJobPolling(jobId) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(!!jobId);
  const [error, setError] = useState(null);
  const activeRef = useRef(true);
  const timerRef = useRef(null);

  useEffect(() => {
    activeRef.current = true;

    if (!jobId) {
      setJob(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    async function tick() {
      if (!activeRef.current) return;
      try {
        const data = await api.get(`/jobs/${jobId}`);
        if (!activeRef.current) return;
        setJob(data.job);
        setError(null);
        setLoading(false);

        if (data.job.status === 'pending' || data.job.status === 'running') {
          timerRef.current = setTimeout(tick, 2000);
        }
      } catch (err) {
        if (!activeRef.current) return;
        setLoading(false);
        if (err.status === 404) {
          setJob(null);
          setError('NOT_FOUND');
        } else {
          setError(err.message);
          timerRef.current = setTimeout(tick, 3000);
        }
      }
    }

    tick();

    return () => {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [jobId]);

  return { job, loading, error };
}

export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.15 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}
