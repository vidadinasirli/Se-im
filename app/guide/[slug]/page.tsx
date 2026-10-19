import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AgentPageContent } from "@/app/agent-page-content";
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
    alternates: { canonical: `/guide/${page.slug}` },
    robots: page.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "article",
      title: page.title,
      description: page.description,
      url: `/guide/${page.slug}`,
      locale: "az_AZ"
    }
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await prisma.agentPage.findUnique({ where: { slug } });
  if (!page) notFound();

  return (
    <AgentPageContent
      title={page.title}
      description={page.description}
      content={page.content}
      sourceUrl={page.sourceUrl}
      updatedAt={page.updatedAt}
    />
  );
}
