import type { Metadata } from "next";
import { NewsletterUnsubscribe } from "./newsletter-unsubscribe";

export const metadata: Metadata = {
  title: "Bülleten abunəliyini ləğv et",
  alternates: { canonical: "/newsletter/unsubscribe" },
  robots: { index: false, follow: false }
};

export default async function NewsletterUnsubscribePage({
  searchParams
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const value = (await searchParams).token;
  const token = (Array.isArray(value) ? value[0] : value) ?? "";
  const validToken = /^[A-Za-z0-9_-]{32,100}$/.test(token) ? token : "";

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold">Bülleten abunəliyini ləğv et</h1>
      {validToken ? (
        <NewsletterUnsubscribe token={validToken} />
      ) : (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          Abunəlikdən çıxış keçidi düzgün deyil.
        </p>
      )}
    </main>
  );
}
