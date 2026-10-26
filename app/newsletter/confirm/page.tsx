import type { Metadata } from "next";
import { NewsletterConfirmation } from "./newsletter-confirmation";

export const metadata: Metadata = {
  title: "Bülleten abunəliyini təsdiqlə",
  alternates: { canonical: "/newsletter/confirm" },
  robots: { index: false, follow: false }
};

export default async function NewsletterConfirmationPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const value = (await searchParams).token;
  const token = (Array.isArray(value) ? value[0] : value) ?? "";
  const validToken = /^[A-Za-z0-9_-]{32,100}$/.test(token) ? token : "";

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold">E-poçt abunəliyini təsdiqlə</h1>
      {validToken ? (
        <NewsletterConfirmation token={validToken} />
      ) : (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          Təsdiq keçidi düzgün deyil və ya natamamdır.
        </p>
      )}
    </main>
  );
}
