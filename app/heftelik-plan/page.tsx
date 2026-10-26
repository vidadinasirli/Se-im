import type { Metadata } from "next";
import Link from "next/link";
import { NewsletterForm } from "./newsletter-form";

export const metadata: Metadata = {
  title: "Həftənin hazırlıq planı",
  description:
    "Azərbaycan dilində həftəlik imtahan hazırlıq planını e-poçtla al. Abunəlik ikiqat təsdiqlə və inzibatçı yoxlaması ilə göndərilir.",
  alternates: { canonical: "/heftelik-plan" },
  openGraph: {
    type: "website",
    title: "Həftənin hazırlıq planı",
    description: "Təsdiqlənmiş test mövzularına əsaslanan həftəlik hazırlıq bülleteni."
  }
};

export default function WeeklyPlanPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 sm:px-6">
      <nav aria-label="Əsas naviqasiya" className="mb-8 text-sm text-blue-800">
        <Link className="underline underline-offset-2" href="/">Ana səhifə</Link>
        <span aria-hidden="true"> / </span>
        <span>Həftəlik plan</span>
      </nav>
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Həftədə bir dəfə
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Həftənin hazırlıq planı
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          Təsdiqlənmiş test mövzuları əsasında hazırlanan həftəlik çalışma planını e-poçtla al.
          Hər bülleten göndərilməzdən əvvəl inzibatçı tərəfindən yoxlanılır.
        </p>
      </header>
      <NewsletterForm />
      <p className="mt-5 text-sm leading-6 text-slate-600">
        Abunəlik əvvəlcə e-poçt təsdiqi tələb edir. Məktublardakı keçidlə istənilən vaxt çıxmaq
        mümkündür. Bu xidmət aktivləşməsi üçün saytda e-poçt göndəriş provayderi sazlanmalıdır.
      </p>
    </main>
  );
}
