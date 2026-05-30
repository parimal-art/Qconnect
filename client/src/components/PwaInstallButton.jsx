import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

const isStandaloneMode = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

export default function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => isStandaloneMode());
  const [hint, setHint] = useState('');

  useEffect(() => {
    const onBeforeInstallPrompt = event => {
      event.preventDefault();
      setInstallPrompt(event);
      setInstalled(false);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setHint('');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    const onDisplayModeChange = event => setInstalled(Boolean(event.matches));
    mediaQuery?.addEventListener?.('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      mediaQuery?.removeEventListener?.('change', onDisplayModeChange);
    };
  }, []);

  const installApp = async () => {
    if (installed) return;

    if (!installPrompt) {
      setHint('Use browser menu → Install app / Add to home screen.');
      window.setTimeout(() => setHint(''), 4000);
      return;
    }

    installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice?.outcome === 'accepted') {
      setInstalled(true);
    }

    setInstallPrompt(null);
  };

  if (installed) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={installApp}
        className="btn-secondary flex items-center gap-2 whitespace-nowrap px-3 py-2"
        title="Install CRM PWA app"
      >
        <Download size={16} />
        <span className="hidden sm:inline">Install App</span>
      </button>

      {hint && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-600 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          {hint}
        </div>
      )}
    </div>
  );
}
