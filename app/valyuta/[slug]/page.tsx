import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AgentPageContent } from "@/app/agent-page-content";
import { CurrencyConverter } from "@/app/valyuta/[slug]/converter";
import { currencyPageDataSchema } from "@/lib/agent-page-schema";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await prisma.agentPage.findUnique({ where: { slug } });
  if (!page) return { title: "Səhifə tapılmadı", robots: { index: false, follow: false } };
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/valyuta/${page.slug}` },
    robots: page.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "article",
      title: page.title,
      description: page.description,
      url: `/valyuta/${page.slug}`,
      locale: "az_AZ"
    }
  };
}

export default async function CurrencyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await prisma.agentPage.findUnique({ where: { slug } });
  if (!page || slug !== "azn-try-cevirici") notFound();

  const parsedData = currencyPageDataSchema.safeParse(page.structuredData);
  if (!parsedData.success) {
    throw new Error(`Valyuta məzənnəsi "${slug}" səhifəsi üçün düzgün qurulmayıb.`);
  }

  return (
    <AgentPageContent
      title={page.title}
      description={page.description}
      content={page.content}
      sourceUrl={page.sourceUrl}
      updatedAt={page.updatedAt}
    >
      <CurrencyConverter rateAzN={parsedData.data.rateAzN} />
    </AgentPageContent>
  );
}
