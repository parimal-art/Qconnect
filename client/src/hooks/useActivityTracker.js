import { useEffect, useRef } from 'react';

import api from '../lib/api';
import { markPendingAppClose } from '../lib/authStorage';
import { connectSocket } from '../lib/socket';

const IDLE_AFTER_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;

const isCrmScreenActive = () =>
  document.visibilityState === 'visible' && document.hasFocus();

export function useActivityTracker(enabled = true) {
  const lastActivityRef = useRef(Date.now());
  const stateRef = useRef('Active');

  useEffect(() => {
    if (!enabled) return undefined;

    const socket = connectSocket();

    const send = async (state, metadata = {}) => {
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
        // Ignore temporary network errors.
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
      if (stateRef.current !== 'Idle') {
        send('Idle', metadata);
      }
    };

    const checkIdleByInactivity = () => {
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
      markIdle({
        event: 'window_blur',
        reason: 'employee_switched_tab_or_window'
      });
    };

    const handleFocus = () => {
      lastActivityRef.current = Date.now();

      send('Active', {
        event: 'window_focus',
        reason: 'employee_focused_crm_screen'
      });
    };

    const handlePossibleAppClose = () => {
      // Important:
      // Do not clear token here.
      // Do not call logout API here.
      // Refresh and close both trigger beforeunload/pagehide.
      // We only mark a pending close. App.jsx decides on next load:
      // reload = continue login, normal open after close = logout.
      markPendingAppClose();
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

    window.addEventListener('pagehide', handlePossibleAppClose);
    window.addEventListener('beforeunload', handlePossibleAppClose);

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

      window.removeEventListener('pagehide', handlePossibleAppClose);
      window.removeEventListener('beforeunload', handlePossibleAppClose);

      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);
}