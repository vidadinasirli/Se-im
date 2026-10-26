import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Əlaqə",
  description:
    "Abituriyent hazırlığı saytı ilə əlaqə saxlayın, məlumat xətası bildirin və təklif göndərin.",
  alternates: { canonical: "/elaqe" },
  openGraph: {
    type: "article",
    title: "Əlaqə",
    description: "Məlumat xətası və təkliflər üçün əlaqə məlumatları."
  }
};

export default function ContactPage() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Əlaqə",
    inLanguage: "az",
    ...(email
      ? {
          mainEntity: {
            "@type": "Organization",
            name: "Abituriyent hazırlığı",
            email
          }
        }
      : {})
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Əlaqə</h1>
      <p className="mt-5 leading-8 text-slate-700">
        Səhifədə səhv məlumat, işləməyən keçid və ya əlçatanlıq problemi görmüsünüzsə, bizə yazın.
        Məlumat xətası bildirişinə səhifənin ünvanını və yoxlamağa kömək edəcək rəsmi mənbəni əlavə edin.
      </p>
      {email ? (
        <p className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
          E-poçt:{" "}
          <a className="font-semibold text-blue-800 underline" href={`mailto:${email}`}>
            {email}
          </a>
        </p>
      ) : (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 leading-7">
          Əlaqə e-poçtu hələ konfiqurasiya edilməyib. Sayt yayımlanmadan əvvəl{" "}
          <code>NEXT_PUBLIC_CONTACT_EMAIL</code> dəyərini təyin edin.
        </p>
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
    </main>
  );
}
