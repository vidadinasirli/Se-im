import { collectAgentPageTraffic } from "@/jobs/collect-agent-signals";
import { prisma } from "@/lib/prisma";

// Avtomatik səhifələrdə ölçülmüş analitika siqnallarını yoxlayıb inzibatçıya baxış təklif edir.
export async function reviewAgentPageQuality(now = new Date()) {
  const pages = await prisma.agentPage.findMany({
    where: { autoPublished: true, noindex: false },
    select: { slug: true, title: true, publishedAt: true, updatedAt: true }
  });
  const paths = pages.map((page) =>
    page.slug === "azn-try-cevirici" ? `/valyuta/${page.slug}` : `/guide/${page.slug}`
  );
  if (paths.length === 0) return { reviewed: 0, recommendations: 0 };
  let traffic: Awaited<ReturnType<typeof collectAgentPageTraffic>>;
  try {
    traffic = await collectAgentPageTraffic(paths);
  } catch (error) {
    await prisma.agentLog.create({
      data: {
        level: "ERROR",
        stage: "page-quality",
        message: "GA4 səhifə göstəricilərini almaq mümkün olmadı.",
        details: { error: error instanceof Error ? error.message : "Naməlum xəta" }
      }
    });
    throw error;
  }
  if (!traffic) {
    await prisma.agentLog.create({
      data: {
        level: "WARNING",
        stage: "page-quality",
        message: "Səhifə trafikini ölçmək üçün GA4_PROPERTY_ID sazlanmalıdır."
      }
    });
    return { reviewed: pages.length, recommendations: 0, analyticsConfigured: false };
  }
  const logs: Array<{ stage: string; message: string }> = [];

  for (const [index, page] of pages.entries()) {
    const path = paths[index];
    const pageTraffic = traffic.get(path);
    if (!pageTraffic) continue;
    await prisma.signal.create({
      data: {
        source: "GA4",
        topic: path,
        rawValue: {
          periodDays: 90,
          pageViews: pageTraffic.quarterly.views,
          sessions: pageTraffic.quarterly.sessions,
          engagementSeconds: pageTraffic.quarterly.engagementSeconds,
          recentPageViews: pageTraffic.recent.views,
          recentSessions: pageTraffic.recent.sessions,
          recentEngagementSeconds: pageTraffic.recent.engagementSeconds,
          measuredAt: now.toISOString()
        },
        observedAt: now,
        score: pageTraffic.quarterly.views + pageTraffic.quarterly.sessions
      }
    });

    const publicationAge = now.getTime() - page.publishedAt.getTime();
    const updateAge = now.getTime() - page.updatedAt.getTime();
    const isStale = updateAge >= 90 * 86_400_000 && pageTraffic.quarterly.views === 0;
    const stage = isStale
      ? `quality-90d:${page.slug}`
      : !isStale &&
          publicationAge >= 48 * 60 * 60_000 &&
          (pageTraffic.recent.views === 0 || pageTraffic.recent.engagementSeconds === 0)
        ? `quality-48h:${page.slug}`
        : null;
    if (!stage) continue;
    const existing = await prisma.agentLog.findFirst({ where: { stage } });
    if (existing) continue;

    const message = isStale
      ? `${page.title} səhifəsi 90 gündür yenilənməyib və GA4 artım siqnalı yoxdur; yeniləmə, birləşdirmə və ya indeksdən çıxarmağı nəzərdən keçirin.`
      : `${page.title} səhifəsinin son 48 saatında baxış və ya qarşılıqlı əlaqə qeydə alınmayıb; məzmun keyfiyyətini və indekslənməni yoxlayın.`;
    await prisma.agentLog.create({
      data: {
        level: "WARNING",
        stage,
        message,
        details: { slug: page.slug, path, updatedAt: page.updatedAt.toISOString() }
      }
    });
    logs.push({ stage, message });
  }
  return { reviewed: pages.length, recommendations: logs.length };
}
