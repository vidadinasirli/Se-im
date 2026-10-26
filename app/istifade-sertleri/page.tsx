import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "İstifadə şərtləri",
  description:
    "Abituriyent hazırlığı saytındakı test, təqvim və məlumat resurslarından istifadə şərtləri.",
  alternates: { canonical: "/istifade-sertleri" },
  openGraph: {
    type: "article",
    title: "İstifadə şərtləri",
    description: "Təhsil resurslarının istifadəsi və məhdudiyyətləri."
  }
};

export default function TermsPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "İstifadə şərtləri",
    inLanguage: "az",
    dateModified: "2026-10-25"
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">İstifadə şərtləri</h1>
      <p className="mt-3 text-sm text-slate-600">Son yeniləmə: 25 oktyabr 2026</p>
      <div className="mt-6 space-y-5 leading-8 text-slate-700">
        <p>
          Sayt imtahana hazırlıq üçün maarifləndirici material təqdim edir. Saytdan istifadə etməklə
          bu şərtləri qəbul edirsiniz.
        </p>
        <h2 className="text-xl font-semibold text-slate-950">Məlumatın xarakteri</h2>
        <p>
          Təqvim, qəbul göstəricisi və simulyator nəticələri rəsmi qəbul qərarı və ya qəbul zəmanəti
          deyil. Məlumat yenilənə və dəyişə bilər. Qeydiyyat, imtahan qaydası və son qərar üçün DİM-in
          rəsmi elanına istinad edin.
        </p>
        <h2 className="text-xl font-semibold text-slate-950">Testlər və süni intellekt</h2>
        <p>
          Test materialı öyrənmə məqsədi daşıyır. Süni intellektlə hazırlanmış sual inzibatçı
          yoxlamasından əvvəl dərc edilmir. Chatbot yalnız saytda tapdığı məzmuna əsaslanan cavab
          verməyə çalışır və rəsmi qərarı əvəz etmir.
        </p>
        <h2 className="text-xl font-semibold text-slate-950">Məqbul istifadə</h2>
        <p>
          Saytın təhlükəsizliyini pozmağa, avtomatlaşdırılmış həddən artıq sorğu göndərməyə və ya
          başqasının hüquqlarını pozan məzmun yükləməyə cəhd etməyin. Sayt məzmunu əvvəlcədən yazılı
          razılıq olmadan kommersiya məqsədilə kütləvi surətdə köçürülə bilməz.
        </p>
        <h2 className="text-xl font-semibold text-slate-950">Əlaqə</h2>
        <p>
          Səhv və ya şərtlərlə bağlı sual üçün <a className="font-semibold text-blue-800 underline" href="/elaqe">əlaqə səhifəsinə</a> keçin.
          Bu sənəd hüquqi məsləhət deyil; yayımdan əvvəl yerli hüquqşünas tərəfindən yoxlanmalıdır.
        </p>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
    </main>
  );
}
