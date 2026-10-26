import type { MetadataRoute } from "next";
import { questionGroups } from "@/lib/question-schema";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const pages = [
    "/",
    "/imtahan-teqvimi",
    "/universitet-ixtisas",
    "/bal-hesabla",
    "/hazirliq-plani",
    "/heftelik-plan",
    "/haqqimizda",
    "/elaqe",
    "/mexfilik-siyaseti",
    "/istifade-sertleri"
  ];
  const testPages = Object.keys(questionGroups).map((group) => `/testler/${group}`);
  const agentPages = await prisma.agentPage.findMany({
    where: { noindex: false },
    select: { slug: true, updatedAt: true }
  });

  return [
    ...[...pages, ...testPages].map((path) => ({
      url: new URL(path, baseUrl).toString(),
      lastModified: new Date(),
      changeFrequency: path === "/" ? "daily" as const : "weekly" as const,
      priority: path === "/" ? 1 : 0.8
    })),
    ...agentPages.map((page) => {
      const path = page.slug === "azn-try-cevirici"
        ? `/valyuta/${page.slug}`
        : `/guide/${page.slug}`;
      return {
        url: new URL(path, baseUrl).toString(),
        lastModified: page.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7
      };
    })
  ];
}
