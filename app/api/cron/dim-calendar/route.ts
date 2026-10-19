import { NextResponse } from "next/server";
import { runDimCalendarJob } from "@/jobs/dim-calendar";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "İcazə yoxdur." }, { status: 401 });
  }

  try {
    const result = await runDimCalendarJob();
    await prisma.jobLog.create({
      data: {
        jobName: "dim-calendar",
        status: "SUCCESS",
        message: `${result.found} elan tapıldı; ${result.pending} dəyişiklik təsdiq gözləyir; ${result.withoutDate} elan tarixsizdir.`
      }
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Naməlum tapşırıq xətası.";
    await prisma.jobLog.create({
      data: { jobName: "dim-calendar", status: "ERROR", message }
    });
    return NextResponse.json({ error: "DİM təqvimi yenilənmədi." }, { status: 500 });
  }
}
