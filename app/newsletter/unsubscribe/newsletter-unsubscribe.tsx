"use client";

import { useState } from "react";

export function NewsletterUnsubscribe({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function unsubscribe() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Abunəlik ləğv edilmədi.");
      setMessage(result.message ?? "Abunəlik ləğv edildi.");
    } catch (unsubscribeError) {
      setError(
        unsubscribeError instanceof Error
          ? unsubscribeError.message
          : "Abunəlik ləğv edilmədi."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <p className="leading-7 text-slate-700">Həftəlik hazırlıq planı məktublarını almaq istəmirsən?</p>
      {error && <p role="alert" className="mt-3 text-red-800">{error}</p>}
      {message ? (
        <p role="status" className="mt-3 font-semibold text-emerald-800">{message}</p>
      ) : (
        <button
          type="button"
          onClick={unsubscribe}
          disabled={busy || token.length < 32}
          className="mt-4 min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-semibold disabled:opacity-60"
        >
          {busy ? "Ləğv edilir…" : "Abunəlikdən çıx"}
        </button>
      )}
    </section>
  );
}
