import { NextResponse } from "next/server";
import { z } from "zod";
import { ensurePublishPolicy } from "@/jobs/admin-agent";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [policy, logs, opportunities, signals, publishedPages] = await Promise.all([
    ensurePublishPolicy(),
    prisma.agentLog.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.opportunity.findMany({
      where: { status: { in: ["CANDIDATE", "PROCESSING", "PENDING_REVIEW"] } },
      orderBy: { score: "desc" },
      take: 20
    }),
    prisma.signal.findMany({ orderBy: { observedAt: "desc" }, take: 30 }),
    prisma.agentPage.findMany({
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: { slug: true, title: true, publishedAt: true, noindex: true, confidence: true }
    })
  ]);

  return NextResponse.json({
    policy,
    logs: logs.map((entry) => ({
      ...entry,
      details: entry.details ? JSON.stringify(entry.details) : null
    })),
    opportunities,
    signals,
    publishedPages,
    observedAt: new Date().toISOString()
  });
}

const policySchema = z.object({
  killSwitch: z.boolean().optional(),
  maxPagesPerDay: z.number().int().min(0).max(100).optional(),
  maxPagesPerHour: z.number().int().min(0).max(24).optional(),
  minimumConfidence: z.number().min(0).max(1).optional(),
  similarityLimit: z.number().min(0.1).max(0.95).optional(),
  minimumContentChars: z.number().int().min(200).max(10_000).optional(),
  dailyTokenBudget: z.number().int().min(1_000).max(2_000_000).optional()
});

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Siyasət məlumatı düzgün deyil." }, { status: 400 });
  }
  const parsed = policySchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return NextResponse.json({ error: "Siyasət dəyərləri qəbul edilmir." }, { status: 400 });
  }

  const before = await ensurePublishPolicy();
  const updated = await prisma.publishPolicy.update({
    where: { id: 1 },
    data: parsed.data
  });
  const killChanged = parsed.data.killSwitch !== undefined;
  await prisma.agentLog.create({
    data: {
      level: killChanged && parsed.data.killSwitch ? "WARNING" : "INFO",
      stage: killChanged ? "kill-switch" : "publish-policy",
      message: killChanged
        ? parsed.data.killSwitch
          ? "Böyük QIRMIZI KILL SWITCH aktivləşdirildi."
          : "KILL SWITCH söndürüldü."
        : "Nəşr siyasəti inzibatçı tərəfindən dəyişdirildi.",
      details: {
        before: {
          killSwitch: before.killSwitch,
          maxPagesPerDay: before.maxPagesPerDay,
          maxPagesPerHour: before.maxPagesPerHour
        },
        updated: parsed.data
      }
    }
  });
  return NextResponse.json({ policy: updated });
}
