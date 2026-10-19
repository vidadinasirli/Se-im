"use client";

import { useCallback, useEffect, useState } from "react";

type AgentLog = {
  id: string;
  level: string;
  stage: string;
  message: string;
  createdAt: string;
};
type AgentSignal = {
  id: string;
  source: string;
  topic: string;
  score: number;
  observedAt: string;
};
type Opportunity = {
  id: string;
  topic: string;
  status: string;
  score: number;
  reason: string | null;
};
type AgentStatus = {
  policy: {
    killSwitch: boolean;
    maxPagesPerDay: number;
    maxPagesPerHour: number;
    minimumConfidence: number;
    similarityLimit: number;
    minimumContentChars: number;
    dailyTokenBudget: number;
    tokensUsedToday: number;
  };
  logs: AgentLog[];
  signals: AgentSignal[];
  opportunities: Opportunity[];
  publishedPages: Array<{
    slug: string;
    title: string;
    publishedAt: string;
    noindex: boolean;
    confidence: number;
  }>;
  observedAt: string;
};

// Agent qeydlərini periodik yeniləyir və nəşr siyasətini idarə edir.
export function AgentControlPanel() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/agent-status", { cache: "no-store" });
      if (!response.ok) throw new Error("Agent vəziyyətini yükləmək mümkün olmadı.");
      setStatus((await response.json()) as AgentStatus);
      setError("");
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Yükləmə xətası.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function updatePolicy(values: Record<string, boolean | number>) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/agent-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Siyasəti saxlamaq mümkün olmadı.");
      }
      await refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Saxlama xətası.");
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return (
      <section className="mb-10 rounded-xl border border-slate-200 bg-white p-5">
        {error || "Agent vəziyyəti yüklənir…"}
      </section>
    );
  }

  const { policy } = status;
  return (
    <section className="mb-10 space-y-5 rounded-xl border border-slate-300 bg-white p-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Admin AI Agent</h2>
          <p className="mt-1 text-sm text-slate-600">
            Canlı yenilənmə: {new Date(status.observedAt).toLocaleTimeString("az-AZ")}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void updatePolicy({ killSwitch: !policy.killSwitch })}
          className={`min-h-14 rounded-xl px-6 py-3 text-lg font-black text-white shadow-lg focus-visible:outline-4 focus-visible:outline-offset-2 ${
            policy.killSwitch
              ? "bg-emerald-700 focus-visible:outline-emerald-700"
              : "bg-red-700 focus-visible:outline-red-700"
          }`}
        >
          {policy.killSwitch ? "AVTOMATİK YAYINI AKTİVLƏŞDİR" : "⛔ KILL SWITCH — YAYINI DAYANDIR"}
        </button>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold">Nəşr siyasəti</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PolicyNumber
              label="Gündəlik səhifə həddi"
              value={policy.maxPagesPerDay}
              onSave={(value) => updatePolicy({ maxPagesPerDay: value })}
              disabled={busy}
            />
            <PolicyNumber
              label="Saatlıq səhifə həddi"
              value={policy.maxPagesPerHour}
              onSave={(value) => updatePolicy({ maxPagesPerHour: value })}
              disabled={busy}
            />
            <PolicyNumber
              label="Etibar həddi (%)"
              value={Math.round(policy.minimumConfidence * 100)}
              min={50}
              max={100}
              onSave={(value) => updatePolicy({ minimumConfidence: value / 100 })}
              disabled={busy}
            />
            <PolicyNumber
              label="Gündəlik token büdcəsi"
              value={policy.dailyTokenBudget}
              min={1_000}
              max={2_000_000}
              onSave={(value) => updatePolicy({ dailyTokenBudget: value })}
              disabled={busy}
            />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Bu gün istifadə edilib: {policy.tokensUsedToday.toLocaleString("az-AZ")} /{" "}
            {policy.dailyTokenBudget.toLocaleString("az-AZ")} token
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold">Fürsət növbəsi</h3>
          {status.opportunities.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">Emal gözləyən fürsət yoxdur.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {status.opportunities.map((opportunity) => (
                <li key={opportunity.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="font-medium">{opportunity.topic}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {opportunity.status} · siqnal balı {opportunity.score.toFixed(1)}
                  </p>
                  {opportunity.reason && (
                    <p className="mt-1 text-sm text-amber-900">{opportunity.reason}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold">Canlı siqnallar</h3>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {status.signals.map((signal) => (
              <li key={signal.id} className="border-b border-slate-100 pb-2 text-sm">
                <span className="font-semibold">{signal.source}</span> · {signal.topic}
                <span className="ml-2 text-slate-500">bal {signal.score.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold">Agent qərarları və hadisələr</h3>
          <ol className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {status.logs.map((entry) => (
              <li key={entry.id} className="border-b border-slate-100 pb-2 text-sm">
                <p
                  className={
                    entry.level === "ERROR"
                      ? "font-medium text-red-800"
                      : entry.level === "WARNING"
                        ? "font-medium text-amber-900"
                        : "text-slate-800"
                  }
                >
                  {entry.message}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {entry.stage} · {new Date(entry.createdAt).toLocaleString("az-AZ")}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      {error && <p role="alert" className="text-sm font-medium text-red-800">{error}</p>}
    </section>
  );
}

function PolicyNumber({
  label,
  value,
  min = 0,
  max = 100,
  disabled,
  onSave
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  disabled: boolean;
  onSave: (value: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <form
      className="space-y-1"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = Number(draft);
        if (Number.isInteger(parsed) && parsed >= min && parsed <= max) void onSave(parsed);
      }}
    >
      <label className="block text-xs text-slate-600">{label}</label>
      <div className="flex gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-10 w-full rounded-md border border-slate-300 px-2"
        />
        <button
          type="submit"
          disabled={disabled || Number(draft) === value}
          className="rounded-md border border-slate-300 px-3 text-sm font-semibold disabled:opacity-50"
        >
          Saxla
        </button>
      </div>
    </form>
  );
}
