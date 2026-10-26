import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Haqqımızda",
  description:
    "Abituriyent hazırlığı saytının məqsədi, təhsil resursları və məlumatların yoxlanma prinsipləri.",
  alternates: { canonical: "/haqqimizda" },
  openGraph: {
    type: "article",
    title: "Haqqımızda",
    description: "Azərbaycan dilində abituriyent hazırlığı üçün təhsil resursları."
  }
};

export default function AboutPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "Haqqımızda",
    inLanguage: "az",
    description: "Abituriyentlər üçün Azərbaycan dilində imtahan hazırlıq resursları."
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Haqqımızda</h1>
      <div className="mt-6 space-y-5 leading-8 text-slate-700">
        <p>
          Abituriyent hazırlığı Azərbaycan dilində imtahan təqvimi, izahlı testlər, mövzu təkrarı və
          universitet seçim resurslarını bir araya gətirmək üçün hazırlanır.
        </p>
        <h2 className="text-xl font-semibold text-slate-950">Məlumat prinsiplərimiz</h2>
        <p>
          DİM tarixləri və qəbul göstəriciləri rəsmi mənbə ilə yoxlanmalıdır. Mənbəsi təsdiqlənməmiş
          tarix və keçid balını fakt kimi dərc etmirik. Tədris sualları cavab və izahı yoxlanana qədər
          yayımlanmır.
        </p>
        <p>
          Saytdakı materiallar hazırlığa kömək məqsədi daşıyır; rəsmi qəbul qaydalarını əvəz etmir.
          Düzəliş və təkliflər üçün <a className="font-semibold text-blue-800 underline" href="/elaqe">əlaqə səhifəsinə</a> keçin.
        </p>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
    </main>
  );
}
