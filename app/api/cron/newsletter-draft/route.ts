import { NextResponse } from "next/server";
import { generateWeeklyNewsletterDraft } from "@/jobs/newsletter-draft";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "İcazə yoxdur." }, { status: 401 });
  }

  try {
    const result = await generateWeeklyNewsletterDraft();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Naməlum xəta";
    await prisma.jobLog.create({
      data: { jobName: "newsletter-draft", status: "ERROR", message: message.slice(0, 1_000) }
    });
    console.error("Həftəlik bülleten qaralaması yaradılmadı:", error);
    return NextResponse.json({ error: "Həftəlik plan qaralaması yaradıla bilmədi." }, { status: 500 });
  }
}
