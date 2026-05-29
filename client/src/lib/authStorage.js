const TOKEN_KEY = 'crm_access_token';
const PENDING_APP_CLOSE_KEY = 'crm_pending_app_close';

const getNavigationType = () => {
  const navigationEntry = performance.getEntriesByType?.('navigation')?.[0];

  if (navigationEntry?.type) {
    return navigationEntry.type;
  }

  if (performance.navigation?.type === 1) {
    return 'reload';
  }

  if (performance.navigation?.type === 2) {
    return 'back_forward';
  }

  return 'navigate';
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = token => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const markPendingAppClose = () => {
  localStorage.setItem(
    PENDING_APP_CLOSE_KEY,
    JSON.stringify({
      at: Date.now()
    })
  );
};

export const clearPendingAppClose = () => {
  localStorage.removeItem(PENDING_APP_CLOSE_KEY);
};

export const shouldLogoutBecauseAppWasClosed = () => {
  const pendingClose = localStorage.getItem(PENDING_APP_CLOSE_KEY);

  if (!pendingClose) {
    return false;
  }

  const navigationType = getNavigationType();

  // Refresh/F5/Ctrl+R/browser refresh should not logout.
  if (navigationType === 'reload') {
    return false;
  }

  return true;
};