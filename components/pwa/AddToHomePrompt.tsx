'use client';

import { useEffect, useMemo, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSED_KEY = 'lexikeep_a2hs_dismissed';

export default function AddToHomePrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const hidden = window.localStorage.getItem(DISMISSED_KEY) === '1';
    setDismissed(hidden);
    setIsIos(/iPad|iPhone|iPod/.test(window.navigator.userAgent));
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const canShow = useMemo(() => {
    if (isStandalone || dismissed) return false;
    return Boolean(deferredPrompt) || isIos;
  }, [deferredPrompt, dismissed, isIos, isStandalone]);

  if (!canShow) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setInstalling(false);
    dismiss();
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 rounded-xl border border-blue-200 bg-white p-3 shadow-lg md:inset-x-auto md:right-4 md:w-96">
      <p className="text-sm font-semibold text-slate-900">Install LexiKeep on your home screen</p>
      {deferredPrompt ? (
        <p className="mt-1 text-xs text-slate-600">Get faster access with an app-like experience.</p>
      ) : (
        <p className="mt-1 text-xs text-slate-600">On iPhone: tap Share, then choose Add to Home Screen.</p>
      )}
      <div className="mt-3 flex gap-2">
        {deferredPrompt && (
          <button
            type="button"
            onClick={() => void install()}
            disabled={installing}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {installing ? 'Installing...' : 'Add App'}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
