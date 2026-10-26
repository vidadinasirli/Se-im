import Link from "next/link";
import { CookieConsentSettingsButton } from "./cookie-consent";

export function SiteFooter() {
  return (
    <>
      <footer className="border-t border-slate-200 bg-white">
        <nav
          aria-label="Məlumat və hüquqi səhifələr"
          className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-3 px-4 py-7 text-sm text-blue-800 sm:px-6"
        >
          <Link href="/haqqimizda" className="underline underline-offset-2">Haqqımızda</Link>
          <Link href="/elaqe" className="underline underline-offset-2">Əlaqə</Link>
          <Link href="/mexfilik-siyaseti" className="underline underline-offset-2">Məxfilik siyasəti</Link>
          <Link href="/istifade-sertleri" className="underline underline-offset-2">İstifadə şərtləri</Link>
          <Link href="/heftelik-plan" className="underline underline-offset-2">Həftəlik plan</Link>
          <CookieConsentSettingsButton />
        </nav>
        <p className="mx-auto max-w-6xl px-4 pb-7 text-xs leading-5 text-slate-500 sm:px-6">
          Təhsil məlumatları məlumatlandırma məqsədi daşıyır. Qəbul qaydaları və tarixlər üçün DİM-in
          rəsmi elanlarını yoxlayın.
        </p>
      </footer>
    </>
  );
}
