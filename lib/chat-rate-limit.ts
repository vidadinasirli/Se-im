import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

const MINUTE_LIMIT = 5;
const DAILY_LIMIT = 30;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// Xam IP-ni saxlamadan IP üzrə dəqiqəlik və gündəlik mesaj sayını məhdudlaşdırır.
export async function consumeChatRateLimit(ipAddress: string) {
  const secret =
    process.env.CHAT_RATE_LIMIT_SECRET || process.env.CRON_SECRET || process.env.GROQ_API_KEY;
  if (!secret) throw new Error("IP limitinin CHAT_RATE_LIMIT_SECRET açarı sazlanmayıb.");

  const now = Date.now();
  const minuteStart = Math.floor(now / MINUTE_MS) * MINUTE_MS;
  const dayStart = Math.floor(now / DAY_MS) * DAY_MS;
  const ipHash = createHmac("sha256", secret).update(ipAddress).digest("hex");

  return prisma.$transaction(async (transaction) => {
    const minute = await transaction.chatRateLimit.upsert({
      where: { id: `${ipHash}:m:${minuteStart}` },
      create: {
        id: `${ipHash}:m:${minuteStart}`,
        count: 1,
        expiresAt: new Date(minuteStart + 2 * MINUTE_MS)
      },
      update: { count: { increment: 1 } }
    });
    const day = await transaction.chatRateLimit.upsert({
      where: { id: `${ipHash}:d:${dayStart}` },
      create: {
        id: `${ipHash}:d:${dayStart}`,
        count: 1,
        expiresAt: new Date(dayStart + 2 * DAY_MS)
      },
      update: { count: { increment: 1 } }
    });

    if (minute.count > MINUTE_LIMIT || day.count > DAILY_LIMIT) {
      return {
        allowed: false,
        retryAfterSeconds:
          minute.count > MINUTE_LIMIT
            ? Math.max(1, Math.ceil((minuteStart + MINUTE_MS - now) / 1_000))
            : Math.max(1, Math.ceil((dayStart + DAY_MS - now) / 1_000))
      };
    }

    if (minuteStart % (10 * MINUTE_MS) === 0) {
      await transaction.chatRateLimit.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
    }

    return { allowed: true as const };
  });
}

export function getClientIp(request: Request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip || "unknown";
}
