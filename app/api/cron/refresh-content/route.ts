import { NextResponse } from "next/server";
import { runRefreshContentJob } from "@/jobs/refresh-content";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "İcazə yoxdur." }, { status: 401 });
  }

  try {
    const result = await runRefreshContentJob();
    await prisma.jobLog.create({
      data: {
        jobName: "refresh-content",
        status: "SUCCESS",
        message: `${result.published} məlumat yayımlandı, ${result.pending} dəyişiklik təsdiq gözləyir.`
      }
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Naməlum tapşırıq xətası.";
    await prisma.jobLog.create({
      data: { jobName: "refresh-content", status: "ERROR", message }
    });
    return NextResponse.json({ error: "Məlumat yenilənmədi." }, { status: 500 });
  }
}
