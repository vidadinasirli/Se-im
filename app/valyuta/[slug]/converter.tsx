"use client";

import { useMemo, useState } from "react";

export function CurrencyConverter({ rateAzN }: { rateAzN: number }) {
  const [amount, setAmount] = useState("1");
  const [direction, setDirection] = useState<"try-to-azn" | "azn-to-try">("try-to-azn");
  const result = useMemo(() => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) return null;
    return direction === "try-to-azn" ? value * rateAzN : value / rateAzN;
  }, [amount, direction, rateAzN]);

  return (
    <section aria-label="Valyuta çeviricisi" className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
      <h2 className="text-xl font-semibold">AZN və TRY çeviricisi</h2>
      <p className="mt-2 text-sm text-slate-700">
        Rəsmi məzənnə: 1 TRY = {rateAzN.toLocaleString("az-AZ", { maximumFractionDigits: 6 })} AZN
      </p>
      <label className="mt-4 block text-sm font-medium" htmlFor="currency-amount">Məbləğ</label>
      <input
        id="currency-amount"
        inputMode="decimal"
        type="number"
        min="0"
        step="any"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 sm:max-w-xs"
      />
      <label className="mt-4 block text-sm font-medium" htmlFor="currency-direction">Çevirmə istiqaməti</label>
      <select
        id="currency-direction"
        value={direction}
        onChange={(event) => setDirection(event.target.value as typeof direction)}
        className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 sm:max-w-xs"
      >
        <option value="try-to-azn">TRY → AZN</option>
        <option value="azn-to-try">AZN → TRY</option>
      </select>
      <p className="mt-4 text-lg font-semibold" aria-live="polite">
        Nəticə: {result === null
          ? "Düzgün məbləğ daxil edin."
          : result.toLocaleString("az-AZ", { maximumFractionDigits: 6 })}{" "}
        {direction === "try-to-azn" ? "AZN" : "TRY"}
      </p>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        Bu hesab yalnız məlumat məqsədi daşıyır; bank və valyuta dəyişmə məntəqələrinin tətbiq etdiyi
        məzənnə fərqli ola bilər.
      </p>
    </section>
  );
}
