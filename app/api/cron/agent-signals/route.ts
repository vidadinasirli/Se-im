import { NextResponse } from "next/server";
import { collectAgentSignals } from "@/jobs/collect-agent-signals";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "İcazə yoxdur." }, { status: 401 });
  }

  try {
    return NextResponse.json(await collectAgentSignals());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Naməlum siqnal toplama xətası.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
