import { createHash, createHmac, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function createNewsletterToken() {
  return randomBytes(32).toString("base64url");
}

export function hashNewsletterToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function consumeNewsletterRateLimit(ipAddress: string) {
  const secret =
    process.env.CHAT_RATE_LIMIT_SECRET || process.env.CRON_SECRET || process.env.GROQ_API_KEY;
  if (!secret) throw new Error("CHAT_RATE_LIMIT_SECRET mühit dəyişəni sazlanmayıb.");

  const minute = Math.floor(Date.now() / 60_000);
  const key = createHmac("sha256", secret)
    .update(`newsletter:${ipAddress}`)
    .digest("hex");
  const entry = await prisma.chatRateLimit.upsert({
    where: { id: `newsletter:${key}:${minute}` },
    create: {
      id: `newsletter:${key}:${minute}`,
      count: 1,
      expiresAt: new Date((minute + 2) * 60_000)
    },
    update: { count: { increment: 1 } }
  });
  if (minute % 10 === 0) {
    await prisma.chatRateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
  return {
    allowed: entry.count <= 3,
    retryAfterSeconds: Math.max(1, (minute + 1) * 60 - Math.floor(Date.now() / 1_000))
  };
}

export async function sendNewsletterEmail(input: {
  to: string;
  subject: string;
  preview: string;
  content: string;
  unsubscribeUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
  idempotencyKey: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NEWSLETTER_FROM;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY və NEWSLETTER_FROM sazlanmayıb.");
  }

  const actionText =
    input.actionUrl && input.actionLabel ? `\n\n${input.actionLabel}: ${input.actionUrl}` : "";
  const unsubscribeText = input.unsubscribeUrl
    ? `\n\nBülletendən çıxmaq: ${input.unsubscribeUrl}`
    : "";
  const text = `${input.preview}\n\n${input.content}${actionText}${unsubscribeText}`;
  const htmlContent = input.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
  const actionHtml =
    input.actionUrl && input.actionLabel
      ? `<p><a href="${escapeHtml(input.actionUrl)}">${escapeHtml(input.actionLabel)}</a></p>`
      : "";
  const unsubscribeHtml = input.unsubscribeUrl
    ? `<p><a href="${escapeHtml(input.unsubscribeUrl)}">Bülletendən çıx</a></p>`
    : "";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text,
      html: `<p>${escapeHtml(input.preview)}</p>${htmlContent}${actionHtml}${unsubscribeHtml}`
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const result = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null;
  if (!response.ok || !result?.id) {
    throw new Error(
      `E-poçt göndərilməsi uğursuz oldu (${response.status}): ${result?.message ?? result?.name ?? "provayder xətası"}`
    );
  }
  return result.id;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });
}
