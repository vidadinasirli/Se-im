import { createPrivateKey, createSign } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SignalInput = {
  source:
    | "GA4"
    | "SEARCH_CONSOLE"
    | "GOOGLE_TRENDS"
    | "SITE_SEARCH"
    | "CHAT_GAP"
    | "DIM"
    | "CENTRAL_BANK";
  topic: string;
  rawValue: Prisma.InputJsonValue;
  observedAt: Date;
  score: number;
  sourceUrl?: string;
};

type GoogleCredentials = { client_email: string; private_key: string };
type GoogleToken = { value: string; expiresAt: number };

const googleTokens = new Map<string, GoogleToken>();
let cbarLastFetchedAt = 0;
let cbarRobots:
  | { expiresAt: number; disallowed: string[] }
  | undefined;
const robotsByHost = new Map<string, { expiresAt: number; disallowed: string[] }>();
let lastExternalRequest = 0;

// Mənbələrdən LLM-siz siqnal yığır və anomaliya göstəricilərinə görə fürsət namizədi yaradır.
export async function collectAgentSignals(now = new Date()) {
  const signals: SignalInput[] = [];
  const errors: string[] = [];

  const collectors = [
    ["Google Analytics", () => collectGa4Signals(now)],
    ["Search Console", () => collectSearchConsoleSignals(now)],
    ["Google Trends", () => collectTrendSignals(now)],
    ["Sayt axtarışı", () => collectSiteSearchSignals(now)],
    ["Cavabsız söhbətlər", () => collectChatGapSignals(now)],
    ["DİM təqvimi", () => collectDimSignals(now)],
    ["Mərkəzi Bank", () => collectCentralBankSignals(now)]
  ] as const;

  for (const [name, collector] of collectors) {
    try {
      signals.push(...(await collector()));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Naməlum xəta";
      errors.push(`${name}: ${message}`);
      await logAgent({
        level: "WARNING",
        stage: "signal-collection",
        message: `${name} siqnalı toplana bilmədi.`,
        details: { error: message }
      });
    }
  }

  const created: Array<{ id: string; topicKey: string }> = [];
  for (const signal of signals) {
    const normalized = normalizeTopic(signal.topic);
    if (!normalized) continue;
    const record = await prisma.signal.create({
      data: {
        source: signal.source,
        topic: signal.topic.slice(0, 240),
        rawValue: signal.rawValue,
        observedAt: signal.observedAt,
        score: signal.score
      }
    });
    await upsertOpportunity(signal, normalized, record.id, now);
    created.push({ id: record.id, topicKey: normalized });
  }

  await logAgent({
    level: errors.length > 0 ? "WARNING" : "INFO",
    stage: "signal-collection",
    message: `${signals.length} siqnal yazıldı; ${new Set(created.map((entry) => entry.topicKey)).size} mövzu yoxlanıldı.`,
    details: { signalCount: signals.length, errors }
  });
  return { signals: signals.length, errors };
}

// Yayımlanmış agent səhifələri üçün GA4-dən baxış və qarşılıqlı əlaqə göstəricilərini alır.
export async function collectAgentPageTraffic(paths: string[]) {
  if (!process.env.GA4_PROPERTY_ID || paths.length === 0) return null;
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/analytics.readonly");
  const propertyId = encodeURIComponent(process.env.GA4_PROPERTY_ID);

  async function requestTraffic(pathsForRequest: string[], period: "2daysAgo" | "90daysAgo") {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate: period, endDate: "today" }],
          dimensions: [{ name: "pagePath" }],
          metrics: [
            { name: "screenPageViews" },
            { name: "sessions" },
            { name: "userEngagementDuration" }
          ],
          dimensionFilter: {
            filter: {
              fieldName: "pagePath",
              inListFilter: { values: pathsForRequest }
            }
          },
          limit: 2_000
        }),
        signal: AbortSignal.timeout(15_000)
      }
    );
    const result = (await response.json()) as {
      rows?: Array<{
        dimensionValues?: Array<{ value?: string }>;
        metricValues?: Array<{ value?: string }>;
      }>;
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(result.error?.message ?? `GA4 ${response.status}`);
    return new Map(
      (result.rows ?? []).map((row) => {
        const path = row.dimensionValues?.[0]?.value ?? "";
        const [views = "0", sessions = "0", engagementSeconds = "0"] =
          row.metricValues?.map((metric) => metric.value ?? "0") ?? [];
        return [
          path,
          {
            views: finiteMetric(views),
            sessions: finiteMetric(sessions),
            engagementSeconds: finiteMetric(engagementSeconds)
          }
        ];
      })
    );
  }

  const metrics = new Map<
    string,
    {
      recent: { views: number; sessions: number; engagementSeconds: number };
      quarterly: { views: number; sessions: number; engagementSeconds: number };
    }
  >();
  for (let offset = 0; offset < paths.length; offset += 100) {
    const batch = paths.slice(offset, offset + 100);
    const [recent, quarterly] = await Promise.all([
      requestTraffic(batch, "2daysAgo"),
      requestTraffic(batch, "90daysAgo")
    ]);
    for (const path of batch) {
      metrics.set(path, {
        recent: recent.get(path) ?? { views: 0, sessions: 0, engagementSeconds: 0 },
        quarterly: quarterly.get(path) ?? { views: 0, sessions: 0, engagementSeconds: 0 }
      });
    }
  }
  return metrics;
}

function finiteMetric(value: string) {
  const metric = Number(value);
  return Number.isFinite(metric) && metric >= 0 ? metric : 0;
}

async function collectGa4Signals(now: Date): Promise<SignalInput[]> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) return [];
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/analytics.readonly");
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: "2daysAgo", endDate: "today" }],
        dimensions: [{ name: "dateHour" }, { name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        limit: 500,
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }]
      }),
      signal: AbortSignal.timeout(15_000)
    }
  );
  const result = (await response.json()) as {
    rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(result.error?.message ?? `GA4 ${response.status}`);

  const currentHour = Math.floor(now.getTime() / 3_600_000) - 1;
  const recentStart = currentHour * 3_600_000;
  const baselineStart = recentStart - 24 * 3_600_000;
  const recent = new Map<string, number>();
  const baseline = new Map<string, number>();
  for (const row of result.rows ?? []) {
    const [dateHour, pagePath = "/"] = row.dimensionValues?.map((value) => value.value ?? "") ?? [];
    if (!/^\d{10}$/.test(dateHour)) continue;
    const timestamp = Date.UTC(
      Number(dateHour.slice(0, 4)),
      Number(dateHour.slice(4, 6)) - 1,
      Number(dateHour.slice(6, 8)),
      Number(dateHour.slice(8, 10))
    );
    const count = Number(row.metricValues?.[0]?.value ?? 0);
    if (!Number.isFinite(count)) continue;
    if (timestamp >= recentStart && timestamp < recentStart + 3_600_000) {
      recent.set(pagePath, (recent.get(pagePath) ?? 0) + count);
    } else if (timestamp >= baselineStart && timestamp < recentStart) {
      baseline.set(pagePath, (baseline.get(pagePath) ?? 0) + count / 24);
    }
  }

  return [...recent.entries()]
    .filter(([, views]) => views >= 3)
    .map(([pagePath, views]) => {
      const average = baseline.get(pagePath) ?? 0;
      const ratio = (views + 1) / (average + 1);
      return {
        source: "GA4" as const,
        topic: pagePath,
        rawValue: { pagePath, viewsLastHour: views, averageHourlyViews: average, ratio },
        observedAt: now,
        score: Math.max(0, Math.log2(ratio))
      };
    })
    .filter((signal) => signal.score >= 1);
}

async function collectSearchConsoleSignals(now: Date): Promise<SignalInput[]> {
  const siteUrl = process.env.GSC_SITE_URL;
  if (!siteUrl) return [];
  const token = await getGoogleAccessToken(
    "https://www.googleapis.com/auth/webmasters.readonly"
  );
  const endpoint =
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}` +
    "/searchAnalytics/query";
  const [recentResponse, baselineResponse] = await Promise.all([
    searchConsoleRequest(endpoint, token, 7, 1),
    searchConsoleRequest(endpoint, token, 28, 8)
  ]);
  const recentRows = recentResponse.rows ?? [];
  const baselineRows = baselineResponse.rows ?? [];
  const baselineByQuery = new Map(
    baselineRows.map((row) => [row.keys?.[0] ?? "", row])
  );

  return recentRows
    .filter((row) => (row.impressions ?? 0) >= 5)
    .map((row) => {
      const query = row.keys?.[0] ?? "";
      const baseline = baselineByQuery.get(query);
      const baselineImpressions = (baseline?.impressions ?? 0) / 4;
      const currentImpressions = (row.impressions ?? 0) / 7;
      const ratio = (currentImpressions + 0.25) / (baselineImpressions + 0.25);
      const noClicks = (row.clicks ?? 0) === 0;
      const rising = ratio >= 1.5;
      return {
        source: "SEARCH_CONSOLE" as const,
        topic: query,
        rawValue: {
          query,
          recentSevenDayImpressions: row.impressions ?? 0,
          recentSevenDayClicks: row.clicks ?? 0,
          baselineDailyImpressions: baselineImpressions,
          ratio,
          rising,
          highImpressionsNoClicks: noClicks
        },
        observedAt: now,
        score: Math.max(0, Math.log2(ratio)) + (noClicks ? 0.5 : 0)
      };
    })
    .filter((signal) => signal.score >= 0.75);
}

async function searchConsoleRequest(endpoint: string, token: string, startOffset: number, endOffset: number) {
  const endDate = new Date(Date.now() - endOffset * 86_400_000).toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - startOffset * 86_400_000).toISOString().slice(0, 10);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 250,
      dataState: "all"
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const result = (await response.json()) as {
    rows?: Array<{
      keys?: string[];
      clicks?: number;
      impressions?: number;
      ctr?: number;
      position?: number;
    }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(result.error?.message ?? `Search Console ${response.status}`);
  return result;
}

async function collectTrendSignals(now: Date): Promise<SignalInput[]> {
  const url = process.env.GOOGLE_TRENDS_RSS_URL ?? "https://trends.google.com/trending/rss?geo=AZ";
  const parsedUrl = new URL(url);
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== "trends.google.com" ||
    parsedUrl.searchParams.get("geo") !== "AZ"
  ) {
    throw new Error("Google Trends üçün yalnız geo=AZ rəsmi RSS ünvanından istifadə olunur.");
  }
  if (!(await isAllowedByRobots(url, "AbituriyentHazirliqBot/1.0"))) {
    throw new Error("Google Trends robots.txt RSS sorğusunu qadağan edir.");
  }
  const response = await rateLimitedFetch(url, {
    headers: { "User-Agent": "AbituriyentHazirliqBot/1.0 (+https://dim.gov.az/)" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Trends RSS ${response.status}`);
  const xml = await response.text();
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return items.slice(0, 30).flatMap((item) => {
    const title = decodeXml(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const traffic = Number(
      decodeXml(item.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/i)?.[1] ?? "")
        .replace(/[+,]/g, "")
    );
    if (!title) return [];
    const safeTraffic = Number.isFinite(traffic) ? traffic : 0;
    return [{
      source: "GOOGLE_TRENDS" as const,
      topic: title,
      rawValue: { title, approximateTraffic: safeTraffic, country: "AZ" },
      observedAt: now,
      score: safeTraffic > 0 ? Math.min(3, Math.log2(safeTraffic + 1) / 3) : 0.5
    }];
  });
}

async function collectSiteSearchSignals(now: Date): Promise<SignalInput[]> {
  const logs = await prisma.siteSearchLog.findMany({
    where: { createdAt: { gte: new Date(now.getTime() - 60 * 60_000) } },
    select: { query: true, createdAt: true }
  });
  const counts = countTopics(logs.map((log) => log.query));
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([topic, count]) => ({
      source: "SITE_SEARCH" as const,
      topic,
      rawValue: { searchesLastHour: count },
      observedAt: now,
      score: Math.log2(count)
    }));
}

async function collectChatGapSignals(now: Date): Promise<SignalInput[]> {
  const logs = await prisma.chatLog.findMany({
    where: {
      result: "NO_CONTEXT",
      createdAt: { gte: new Date(now.getTime() - 60 * 60_000) }
    },
    select: { question: true }
  });
  const counts = countTopics(logs.map((log) => log.question));
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([topic, count]) => ({
      source: "CHAT_GAP" as const,
      topic,
      rawValue: { unansweredQuestionsLastHour: count },
      observedAt: now,
      score: Math.log2(count)
    }));
}

async function collectCentralBankSignals(now: Date): Promise<SignalInput[]> {
  const lastSignal = await prisma.signal.findFirst({
    where: { source: "CENTRAL_BANK", topic: "TRY/AZN" },
    orderBy: { observedAt: "desc" },
    select: { observedAt: true }
  });
  if (
    Date.now() - cbarLastFetchedAt < 15 * 60_000 ||
    (lastSignal && now.getTime() - lastSignal.observedAt.getTime() < 15 * 60_000)
  ) return [];
  const rate = await fetchCbarTryRate(now);
  cbarLastFetchedAt = Date.now();
  const previous = await prisma.signal.findFirst({
    where: { source: "CENTRAL_BANK", topic: "TRY/AZN" },
    orderBy: { observedAt: "desc" },
    select: { rawValue: true }
  });
  const previousRate =
    previous?.rawValue && typeof previous.rawValue === "object" && !Array.isArray(previous.rawValue)
      ? Number(previous.rawValue.rateAzN)
      : rate.rateAzN;
  const ratio = previousRate > 0 ? rate.rateAzN / previousRate : 1;
  return [{
    source: "CENTRAL_BANK",
    topic: "TRY/AZN",
    rawValue: rate,
    observedAt: now,
    score:
      Math.abs(ratio - 1) > 0
        ? Math.max(1.5, Math.min(4, Math.abs(Math.log2(ratio)) * 100))
        : 0,
    sourceUrl: rate.sourceUrl
  }];
}

async function collectDimSignals(now: Date): Promise<SignalInput[]> {
  const events = await prisma.examEvent.findMany({
    where: {
      OR: [{ eventDate: { gte: now } }, { applicationDeadline: { gte: now } }]
    },
    take: 100
  });
  return events.map((event) => ({
    source: "DIM",
    topic: event.title,
    rawValue: {
      eventDate: event.eventDate?.toISOString() ?? null,
      applicationDeadline: event.applicationDeadline?.toISOString() ?? null,
      sourceUrl: event.sourceUrl,
      description: event.description
    },
    observedAt: now,
    score:
      event.eventDate && event.eventDate.getTime() - now.getTime() < 30 * 86_400_000
        ? 1.5
        : 0.5,
    sourceUrl: event.sourceUrl
  }));
}

async function fetchCbarTryRate(now: Date) {
  const configured = process.env.CBAR_RATE_URL;
  if (configured) {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:" || parsed.hostname !== "www.cbar.az") {
      throw new Error("CBAR_RATE_URL yalnız https://www.cbar.az ünvanı ola bilər.");
    }
    if (!(await isAllowedByRobots(configured, "AbituriyentHazirliqBot/1.0 (+https://www.cbar.az/)"))) {
      throw new Error("Mərkəzi Bank robots.txt bu XML ünvanına sorğunu qadağan edir.");
    }
    const response = await rateLimitedFetch(configured, {
      headers: { "User-Agent": "AbituriyentHazirliqBot/1.0 (+https://www.cbar.az/)" },
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`Mərkəzi Bank XML-i ${response.status}`);
    const rate = parseTryRate(await response.text());
    return { ...rate, fetchedAt: now.toISOString(), sourceUrl: configured };
  }

  for (let offset = 0; offset <= 7; offset += 1) {
    const date = new Date(now.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
    const url = `https://www.cbar.az/currencies/${date}.xml`;
    const allowed = await isAllowedByRobots(url);
    if (!allowed) throw new Error("Mərkəzi Bank robots.txt bu XML ünvanına sorğunu qadağan edir.");
    const response = await rateLimitedFetch(url, {
      headers: { "User-Agent": "AbituriyentHazirliqBot/1.0 (+https://www.cbar.az/)" },
      signal: AbortSignal.timeout(15_000)
    });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`Mərkəzi Bank XML-i ${response.status}`);
    const rate = parseTryRate(await response.text());
    return { ...rate, fetchedAt: now.toISOString(), sourceUrl: url };
  }
  throw new Error("Mərkəzi Bankın son 7 gündə TRY məzənnəsi tapılmadı.");
}

function parseTryRate(xml: string) {
  const currency = xml.match(/<Valute\b[^>]*Code=["']TRY["'][^>]*>([\s\S]*?)<\/Valute>/i)?.[1];
  if (!currency) throw new Error("Rəsmi XML-də TRY məzənnəsi yoxdur.");
  const nominal = Number(currency.match(/<Nominal>([\s\S]*?)<\/Nominal>/i)?.[1]?.trim());
  const value = Number(
    currency.match(/<Value>([\s\S]*?)<\/Value>/i)?.[1]?.trim().replace(",", ".")
  );
  if (!Number.isFinite(nominal) || nominal <= 0 || !Number.isFinite(value) || value <= 0) {
    throw new Error("Rəsmi XML-də TRY məzənnəsi düzgün deyil.");
  }
  return {
    rateAzN: value / nominal,
    nominal,
    value,
    currency: "TRY",
    baseCurrency: "AZN"
  };
}

async function upsertOpportunity(
  signal: SignalInput,
  topicKey: string,
  signalId: string,
  now: Date
) {
  const hourAgo = new Date(now.getTime() - 60 * 60_000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);
  const previous = await prisma.signal.findMany({
    where: {
      topic: signal.topic,
      source: signal.source,
      observedAt: { gte: dayAgo, lt: hourAgo }
    },
    select: { score: true, observedAt: true }
  });
  const previousHourlyAverage = previous.reduce((sum, item) => sum + item.score, 0) / 23;
  const anomalyScore =
    previousHourlyAverage > 0
      ? signal.score / previousHourlyAverage
      : signal.score >= 1
        ? signal.score
        : 0;
  const score = Math.max(signal.score, Math.min(anomalyScore, 20));
  const sameTopicLastHour = await prisma.signal.count({
    where: { topic: signal.topic, observedAt: { gte: hourAgo } }
  });
  const existing = await prisma.opportunity.findUnique({ where: { topicKey } });

  await prisma.agentLog.create({
    data: {
      level: "INFO",
      stage: "signal",
      message: `${signal.source}: “${signal.topic.slice(0, 140)}” siqnalı qəbul edildi.`,
      signalId,
      details: {
        score,
        baselineHourlyAverage: previousHourlyAverage,
        samplesLastHour: sameTopicLastHour,
        sourceUrl: signal.sourceUrl ?? null
      }
    }
  });

  if (score < 1.25 && sameTopicLastHour < 2 && !existing) return;

  const sourceUrls = new Set<string>(
    existing && Array.isArray(existing.sourceUrls)
      ? existing.sourceUrls.filter((url): url is string => typeof url === "string")
      : []
  );
  if (signal.sourceUrl) sourceUrls.add(signal.sourceUrl);
  const saved = await prisma.opportunity.upsert({
    where: { topicKey },
    create: {
      topicKey,
      topic: canonicalTopic(signal.topic),
      score,
      sourceCount: 1,
      sourceUrls: [...sourceUrls],
      status: "CANDIDATE",
      firstSeenAt: now,
      lastSeenAt: now
    },
    update: {
      score: { increment: score },
      sourceCount: { increment: 1 },
      sourceUrls: [...sourceUrls],
      lastSeenAt: now,
      status:
        existing?.status === "PUBLISHED" && signal.source === "CENTRAL_BANK" && signal.score > 0
          ? "CANDIDATE"
          : existing?.status === "CANDIDATE"
            ? "CANDIDATE"
            : existing?.status ?? "CANDIDATE"
    }
  });
  await prisma.signal.update({ where: { id: signalId }, data: { opportunityId: saved.id } });
}

async function getGoogleAccessToken(scope: string) {
  const cached = googleTokens.get(scope);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
  const rawCredentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!rawCredentials) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON sazlanmayıb.");
  const credentials = JSON.parse(rawCredentials) as GoogleCredentials;
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Google service account etimadnaməsi düzgün deyil.");
  }

  const now = Math.floor(Date.now() / 1_000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsignedToken = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: credentials.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3_600
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  const assertion = `${unsignedToken}.${signer.sign(createPrivateKey(credentials.private_key)).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const result = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !result.access_token) {
    throw new Error(`Google OAuth: ${result.error_description ?? response.statusText}`);
  }
  const token = {
    value: result.access_token,
    expiresAt: Date.now() + (result.expires_in ?? 3_600) * 1_000
  };
  googleTokens.set(scope, token);
  return token.value;
}

async function isAllowedByRobots(url: string, userAgent = "AbituriyentHazirliqBot/1.0") {
  const parsed = new URL(url);
  const cached = parsed.hostname === "www.cbar.az" ? cbarRobots : robotsByHost.get(parsed.hostname);
  if (!cached || cached.expiresAt < Date.now()) {
    const response = await rateLimitedFetch(`${parsed.origin}/robots.txt`, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`Mərkəzi Bank robots.txt oxunmadı (${response.status}).`);
    const content = await response.text();
    const rules: string[] = [];
    let appliesToAgent = false;
    let hasAgent = false;
    for (const line of content.split(/\r?\n/)) {
      const [rawKey, ...rawValue] = line.split(":");
      const key = rawKey?.trim().toLowerCase();
      const value = rawValue.join(":").trim();
      if (key === "user-agent") {
        if (hasAgent && appliesToAgent) break;
        hasAgent = true;
        appliesToAgent = value === "*" || value.toLowerCase().includes("abituriyenthazirliqbot");
      } else if (appliesToAgent && key === "disallow" && value) {
        rules.push(value);
      }
    }
    const robots = { expiresAt: Date.now() + 24 * 60 * 60_000, disallowed: rules };
    if (parsed.hostname === "www.cbar.az") cbarRobots = robots;
    else {
      robotsByHost.set(parsed.hostname, robots);
    }
  }
  const rules =
    parsed.hostname === "www.cbar.az" ? cbarRobots?.disallowed : robotsByHost.get(parsed.hostname)?.disallowed;
  const path = `${parsed.pathname}${parsed.search}`;
  return !(rules ?? []).some((rule) => path.startsWith(rule));
}

async function rateLimitedFetch(url: string, init: RequestInit) {
  const wait = Math.max(0, lastExternalRequest + 1_000 - Date.now());
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastExternalRequest = Date.now();
  return fetch(url, init);
}

function countTopics(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = normalizeTopic(value);
    if (!normalized || normalized.length < 2) continue;
    counts.set(canonicalTopic(value), (counts.get(canonicalTopic(value)) ?? 0) + 1);
  }
  return counts;
}

function normalizeTopic(topic: string) {
  return topic
    .toLocaleLowerCase("az")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .sort()
    .join(" ")
    .slice(0, 200);
}

function canonicalTopic(topic: string) {
  const normalized = normalizeTopic(topic);
  if (/\b(try|turk lirasi|turkiye lirasi)\b/.test(normalized) && /\b(azn|manat)\b/.test(normalized)) {
    return "TRY AZN valyuta məzənnəsi və çevirici";
  }
  return topic.trim().replace(/\s+/g, " ").slice(0, 240);
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

async function logAgent(data: {
  level: "INFO" | "WARNING" | "ERROR";
  stage: string;
  message: string;
  details?: Prisma.InputJsonValue;
}) {
  await prisma.agentLog.create({ data });
}
