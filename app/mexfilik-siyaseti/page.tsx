import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Məxfilik siyasəti",
  description:
    "Saytda test nəticələrinin, brauzer yaddaşının, chatbot suallarının və e-poçt abunəliyinin necə işlənməsi barədə məlumat.",
  alternates: { canonical: "/mexfilik-siyaseti" },
  openGraph: {
    type: "article",
    title: "Məxfilik siyasəti",
    description: "Abituriyent hazırlığı saytında məlumatların işlənməsi qaydası."
  }
};

const updatedAt = "25 oktyabr 2026";

export default function PrivacyPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Məxfilik siyasəti",
    inLanguage: "az",
    dateModified: "2026-10-25"
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Məxfilik siyasəti</h1>
      <p className="mt-3 text-sm text-slate-600">Son yeniləmə: {updatedAt}</p>
      <div className="mt-6 space-y-5 leading-8 text-slate-700">
        <p>
          Bu siyasət saytda hansı məlumatların işlənməsini, məqsədini və idarə olunma yollarını izah
          edir. Sayt istifadəyə verilməzdən əvvəl hüquqi şəxsin və real əlaqə kanalının məlumatları ilə
          yenilənməlidir.
        </p>
        <h2 className="text-xl font-semibold text-slate-950">Brauzerdə saxlanılan məlumat</h2>
        <p>
          Test cavabları, hazırlıq planının tamamlanma qeydləri və cookie seçimləri qeydiyyat
          tələb etmədən cihazın localStorage yaddaşında saxlanılır. Bu qeydləri brauzer yaddaşını
          təmizləməklə silə bilərsiniz.
        </p>
        <h2 className="text-xl font-semibold text-slate-950">Chatbot və təhlükəsizlik qeydləri</h2>
        <p>
          Chatbot sualları cavab keyfiyyətini və çatışmayan məzmunu qiymətləndirmək üçün saxlanıla
          bilər. E-poçt, telefon, FIN kodu və şifrə kimi tanınan nümunələr qeydə alınmazdan əvvəl
          gizlədilir; buna baxmayaraq, şəxsi və həssas məlumat yazmayın. Rate limit üçün xam IP yox,
          gizli açarla yaradılmış xülasə istifadə olunur. Texniki iş qeydləri nasazlıqların araşdırılması
          üçün saxlanıla bilər.
        </p>
        <h2 className="text-xl font-semibold text-slate-950">E-poçt bülleteni</h2>
        <p>
          Həftəlik bülletenə yalnız açıq razılıq və e-poçt təsdiqindən sonra abunə olursunuz. Ünvan
          yalnız bülleten göndərmək və abunəlik vəziyyətini idarə etmək üçün istifadə edilir. Hər
          məktubdakı abunəlikdən çıxış keçidi ünvanınızı və ona bağlı göndəriş qeydlərini silir.
        </p>
        <h2 className="text-xl font-semibold text-slate-950">Cookie və analitika</h2>
        <p>
          Hazırda reklam və analitika izləyiciləri aktiv deyil. Razılıq seçimi brauzerdə saxlanır;
          gələcəkdə qeyri-zəruri analitika və ya reklam texnologiyası əlavə edilərsə, bu seçimlər
          yenilənəcək və razılıq tələb olunacaq.
        </p>
        <h2 className="text-xl font-semibold text-slate-950">Məlumat sorğuları</h2>
        <p>
          Məlumatlara çıxış, düzəliş və ya silinmə sorğusu üçün <a className="font-semibold text-blue-800 underline" href="/elaqe">əlaqə səhifəsindən</a> yazın.
          İstehsal öncəsi əlaqə e-poçtu və real məlumat nəzarətçisi bu səhifədə göstərilməlidir.
        </p>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
    </main>
  );
}
