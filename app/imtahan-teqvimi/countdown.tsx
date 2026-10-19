"use client";

import { useEffect, useState } from "react";

// Növbəti təsdiqlənmiş imtahana qalan vaxtı canlı göstərir.
export function Countdown({ eventDate }: { eventDate: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, new Date(eventDate).getTime() - Date.now()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [eventDate]);

  if (remaining === null) return <span>Geri sayım yüklənir…</span>;
  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (remaining === 0) return <span>İmtahan günü çatıb.</span>;
  return <span>{days} gün, {hours} saat, {minutes} dəqiqə</span>;
}
