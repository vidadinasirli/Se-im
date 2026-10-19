import { NextResponse } from "next/server";
import { reviewAgentPageQuality } from "@/jobs/agent-maintenance";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "İcazə yoxdur." }, { status: 401 });
  }

  try {
    return NextResponse.json(await reviewAgentPageQuality());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Naməlum səhifə yoxlama xətası.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
