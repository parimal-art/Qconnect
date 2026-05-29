import { useEffect, useRef } from 'react';

import api from '../lib/api';
import { getToken, markPendingAppClose } from '../lib/authStorage';
import { connectSocket } from '../lib/socket';

const IDLE_AFTER_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const isCrmScreenActive = () =>
  document.visibilityState === 'visible' && document.hasFocus();

export function useActivityTracker(enabled = true) {
  const lastActivityRef = useRef(Date.now());
  const stateRef = useRef('Active');
  const closingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const socket = connectSocket();

    const send = async (state, metadata = {}) => {
      if (closingRef.current) return;

      stateRef.current = state;

      socket?.emit('heartbeat', {
        state,
        metadata,
        activitySource: 'CRM_PWA'
      });

      try {
        await api.post('/tracking/heartbeat', {
          state,
          metadata,
          activitySource: 'CRM_PWA'
        });
      } catch {
        // ignore temporary tracking error
      }
    };

    const markActive = event => {
      if (!isCrmScreenActive()) return;

      lastActivityRef.current = Date.now();

      if (stateRef.current !== 'Active') {
        send('Active', {
          event: event?.type || 'activity',
          reason: 'employee_is_on_crm_screen'
        });
      }
    };

    const markIdle = metadata => {
      if (closingRef.current) return;

      if (stateRef.current !== 'Idle') {
        send('Idle', metadata);
      }
    };

    const checkIdleByInactivity = () => {
      if (closingRef.current) return;

      if (!isCrmScreenActive()) {
        markIdle({
          event: 'screen_not_active',
          reason: 'employee_is_using_another_tab_or_window',
          visible: document.visibilityState,
          focused: document.hasFocus()
        });

        return;
      }

      const idleFor = Date.now() - lastActivityRef.current;

      if (idleFor >= IDLE_AFTER_MS) {
        markIdle({
          event: 'no_user_activity',
          reason: 'employee_is_on_crm_screen_but_inactive',
          idleForMs: idleFor
        });
      }
    };

    const handleVisibilityChange = () => {
      if (closingRef.current) return;

      if (document.visibilityState === 'hidden') {
        markIdle({
          event: 'visibility_hidden',
          reason: 'employee_left_crm_screen'
        });

        return;
      }

      lastActivityRef.current = Date.now();

      send('Active', {
        event: 'visibility_visible',
        reason: 'employee_returned_to_crm_screen'
      });
    };

    const handleBlur = () => {
      if (closingRef.current) return;

      markIdle({
        event: 'window_blur',
        reason: 'employee_switched_tab_or_window'
      });
    };

    const handleFocus = () => {
      if (closingRef.current) return;

      lastActivityRef.current = Date.now();

      send('Active', {
        event: 'window_focus',
        reason: 'employee_focused_crm_screen'
      });
    };

    const sendOfflineBeacon = reason => {
      if (closingRef.current) return;

      closingRef.current = true;
      stateRef.current = 'Offline';
      markPendingAppClose();

      const token = getToken();

      if (!token) return;

      const payload = JSON.stringify({
        token,
        metadata: {
          event: 'app_closed',
          reason,
          closedAt: new Date().toISOString()
        }
      });

      const blob = new Blob([payload], {
        type: 'application/json'
      });

      const sent = navigator.sendBeacon?.(
        `${API_BASE}/tracking/offline-beacon`,
        blob
      );

      if (!sent) {
        fetch(`${API_BASE}/tracking/offline-beacon`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: payload,
          credentials: 'include',
          keepalive: true
        }).catch(() => {});
      }

      socket?.emit('heartbeat', {
        state: 'Offline',
        metadata: {
          event: 'app_closed_socket_hint',
          reason
        },
        activitySource: 'CRM_PWA'
      });
    };

    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'click',
      'scroll',
      'touchstart'
    ];

    activityEvents.forEach(eventName => {
      window.addEventListener(eventName, markActive, { passive: true });
    });

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    window.addEventListener('pagehide', () => sendOfflineBeacon('pagehide'));
    window.addEventListener('beforeunload', () => sendOfflineBeacon('beforeunload'));

    document.addEventListener('visibilitychange', handleVisibilityChange);

    send('Active', {
      event: 'tracker_started',
      reason: 'employee_logged_in_and_tracker_started',
      visible: document.visibilityState,
      focused: document.hasFocus()
    });

    const heartbeatTimer = setInterval(() => {
      checkIdleByInactivity();

      send(stateRef.current, {
        event: 'heartbeat',
        visible: document.visibilityState,
        focused: document.hasFocus()
      });
    }, HEARTBEAT_MS);

    const idleTimer = setInterval(checkIdleByInactivity, 15 * 1000);

    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(idleTimer);

      activityEvents.forEach(eventName => {
        window.removeEventListener(eventName, markActive);
      });

      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);

      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);
}