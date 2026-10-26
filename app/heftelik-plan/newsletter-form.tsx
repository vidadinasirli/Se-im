"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          consent,
          website: (event.currentTarget.elements.namedItem("website") as HTMLInputElement).value
        })
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Sorğu göndərilmədi.");
      setMessage(result.message ?? "Təsdiq məktubu göndərildi.");
      setEmail("");
      setConsent(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Sorğu göndərilmədi. Bir qədər sonra yenidən yoxlayın."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <label htmlFor="newsletter-email" className="mb-2 block text-sm font-semibold">
          E-poçt ünvanı
        </label>
        <input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        />
      </div>
      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 size-4 accent-blue-700"
        />
        <span>
          Həftəlik hazırlıq planını almaq üçün e-poçt ünvanımın işlənməsinə razıyam. İstənilən vaxt
          abunəlikdən çıxa biləcəyimi və məlumatların necə işlənməsini{" "}
          <a className="font-semibold text-blue-800 underline" href="/mexfilik-siyaseti">
            məxfilik siyasətində
          </a>{" "}
          oxuduğumu təsdiqləyirəm.
        </span>
      </label>
      <label aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        Veb-sayt
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
      <button
        type="submit"
        disabled={sending}
        className="min-h-11 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60"
      >
        {sending ? "Göndərilir…" : "Abunə ol"}
      </button>
    </form>
  );
}
