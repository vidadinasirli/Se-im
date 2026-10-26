"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Consent = {
  version: 1;
  necessary: true;
  analytics: boolean;
  savedAt: string;
};

const consentKey = "site-cookie-consent-v1";
const openConsentEvent = "open-cookie-consent";

// Non-essential tracking stays disabled unless the visitor explicitly opts in.
export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(consentKey) === null);
    } catch {
      setVisible(true);
      setStorageError("Razılıq seçimini bu brauzerdə saxlamaq mümkün olmadı.");
    }

    const reopen = () => setVisible(true);
    window.addEventListener(openConsentEvent, reopen);
    return () => window.removeEventListener(openConsentEvent, reopen);
  }, []);

  function saveConsent(analytics: boolean) {
    const value: Consent = {
      version: 1,
      necessary: true,
      analytics,
      savedAt: new Date().toISOString()
    };
    try {
      window.localStorage.setItem(consentKey, JSON.stringify(value));
      setVisible(false);
      setStorageError("");
    } catch {
      setStorageError("Razılıq seçimini saxlamaq alınmadı. Seçim bu ziyarət üçün tətbiq edildi.");
      setVisible(false);
    }
  }

  if (!visible) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        className="text-left underline underline-offset-2"
      >
        Cookie seçimləri
      </button>
    );
  }

  return (
    <section
      aria-labelledby="cookie-consent-title"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl rounded-xl border border-slate-300 bg-white p-5 shadow-xl sm:inset-x-6"
    >
      <h2 id="cookie-consent-title" className="font-semibold">
        Məxfilik seçimləri
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        Sayt test nəticələrini, hazırlıq planını və bu seçimi brauzer yaddaşında saxlayır. Hazırda
        reklam və analitika izləyiciləri aktiv deyil.{" "}
        <Link className="font-semibold text-blue-800 underline" href="/mexfilik-siyaseti">
          Məxfilik siyasəti
        </Link>
      </p>
      {storageError && <p role="status" className="mt-2 text-sm text-amber-800">{storageError}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => saveConsent(false)}
          className="min-h-10 rounded-lg border border-slate-300 px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Yalnız zəruri
        </button>
        <button
          type="button"
          onClick={() => saveConsent(true)}
          className="min-h-10 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Hamısına razıyam
        </button>
      </div>
    </section>
  );
}

export function CookieConsentSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(openConsentEvent))}
      className="text-left underline underline-offset-2"
    >
      Cookie seçimləri
    </button>
  );
}
