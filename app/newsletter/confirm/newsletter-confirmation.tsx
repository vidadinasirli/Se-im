"use client";

import { useState } from "react";

export function NewsletterConfirmation({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Təsdiq alınmadı.");
      setMessage(result.message ?? "Abunəlik təsdiqləndi.");
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Təsdiq alınmadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <p className="leading-7 text-slate-700">Həftəlik plan bülleteninə abunəliyi təsdiqlə.</p>
      {error && <p role="alert" className="mt-3 text-red-800">{error}</p>}
      {message ? (
        <p role="status" className="mt-3 font-semibold text-emerald-800">{message}</p>
      ) : (
        <button
          type="button"
          onClick={confirm}
          disabled={busy || token.length < 32}
          className="mt-4 min-h-11 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Təsdiqlənir…" : "Abunəliyi təsdiqlə"}
        </button>
      )}
    </section>
  );
}
