import { useEffect, useRef } from 'react';
import api from '../lib/api';
import { connectSocket } from '../lib/socket';

const IDLE_AFTER_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;

export function useActivityTracker(enabled = true) {
  const lastActivityRef = useRef(Date.now());
  const stateRef = useRef('Active');

  useEffect(() => {
    if (!enabled) return undefined;
    const socket = connectSocket();

    const send = async (state, metadata = {}) => {
      stateRef.current = state;
      socket?.emit('heartbeat', { state, metadata, activitySource: 'CRM_PWA' });
      try { await api.post('/tracking/heartbeat', { state, metadata, activitySource: 'CRM_PWA' }); } catch {}
    };

    const markActive = event => {
      lastActivityRef.current = Date.now();
      if (stateRef.current === 'Idle') send('Active', { event: event?.type || 'activity' });
    };

    const markIdleIfNeeded = () => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= IDLE_AFTER_MS && stateRef.current !== 'Idle' && document.visibilityState === 'visible') {
        send('Idle', { idleForMs: idleFor });
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') send('Idle', { event: 'visibility_hidden' });
      else markActive({ type: 'visibility_visible' });
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'focus'];
    events.forEach(evt => window.addEventListener(evt, markActive, { passive: true }));
    window.addEventListener('blur', () => send('Idle', { event: 'tab_blur' }));
    document.addEventListener('visibilitychange', handleVisibility);

    send('Active', { event: 'tracker_started' });
    const heartbeatTimer = setInterval(() => send(stateRef.current, { event: 'heartbeat' }), HEARTBEAT_MS);
    const idleTimer = setInterval(markIdleIfNeeded, 15 * 1000);

    const beforeUnload = () => navigator.sendBeacon?.(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/tracking/offline`);
    window.addEventListener('beforeunload', beforeUnload);

    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(idleTimer);
      events.forEach(evt => window.removeEventListener(evt, markActive));
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', beforeUnload);
      api.post('/tracking/offline').catch(() => {});
    };
  }, [enabled]);
}
