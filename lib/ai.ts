import { z } from "zod";

const SYSTEM_PROMPT =
  "Sən mənbə mətnindən məlumat çıxaran köməkçisən. Yalnız mənbədə açıq şəkildə olan məlumatı qaytar. " +
  "Mənbədə olmayan məlumatı uydurma. Əmin deyilsənsə null qaytar və etibar skorunu aşağı ver. " +
  "Cavabı yalnız tələb olunan JSON formatında ver.";

const QUESTION_SYSTEM_PROMPT =
  "Sən Azərbaycan dili və riyaziyyat üzrə tədris məzmunu hazırlayan müəllimsən. " +
  "Tapşırığa uyğun, orijinal və həlli yoxlanıla bilən test sualları yaz. " +
  "Düzgün cavabın indeksini və addım-addım qısa izahını diqqətlə yoxla. " +
  "Cavabı yalnız tələb olunan JSON formatında ver.";

type AIProvider = "openai" | "anthropic";

export type ChatMessage = { role: "system" | "user"; content: string };

export class GroqRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = "GroqRequestError";
  }
}

export class GroqBudgetError extends Error {
  constructor() {
    super("Groq günlük token büdcəsi bitib.");
    this.name = "GroqBudgetError";
  }
}

// Seçilmiş AI provayderindən cavab alır və nəticəni Zod sxemi ilə təsdiqləyir.
export async function extractStructuredData<T>(source: string, schema: z.ZodType<T>): Promise<T> {
  return requestStructuredData(source, schema, SYSTEM_PROMPT);
}

// Yeni tədris sualı yaradır; çağıran tərəf onu qaralama kimi saxlamalıdır.
export async function generateStructuredData<T>(
  instruction: string,
  schema: z.ZodType<T>
): Promise<T> {
  return requestStructuredData(instruction, schema, QUESTION_SYSTEM_PROMPT);
}

// Groq cavabını JSON rejimində alır, sxemlə yoxlayır və faktiki token sayını qaytarır.
export async function generateGroqStructuredData<T>(
  instruction: string,
  schema: z.ZodType<T>,
  systemPrompt: string,
  maxOutputTokens = 2_000
): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL;
  if (!apiKey || !model) {
    throw new Error("Admin agent üçün GROQ_API_KEY və GROQ_MODEL sazlanmayıb.");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: maxOutputTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: instruction }
        ]
      }),
      signal: AbortSignal.timeout(45_000)
    });
    const result = (await response.json().catch(() => null)) as
      | {
          choices?: Array<{ message?: { content?: string | null } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
          error?: { message?: string };
        }
      | null;

    if (response.status === 429 && attempt < 2) {
      await delay(
        Math.min(parseRetryAfter(response.headers.get("retry-after")) ?? 500 * 2 ** attempt, 4_000),
        AbortSignal.timeout(5_000)
      );
      continue;
    }
    if (!response.ok) {
      throw new GroqRequestError(
        `Groq agent sorğusu uğursuz oldu (${response.status}): ${result?.error?.message ?? response.statusText}`,
        response.status,
        parseRetryAfter(response.headers.get("retry-after"))
      );
    }

    const content = result?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq agent boş JSON cavabı qaytardı.");
    let value: unknown;
    try {
      value = JSON.parse(content);
    } catch {
      throw new Error("Groq agent cavabı düzgün JSON deyil.");
    }
    return {
      data: schema.parse(value),
      inputTokens: result?.usage?.prompt_tokens ?? Math.ceil(instruction.length / 4),
      outputTokens: result?.usage?.completion_tokens ?? Math.ceil(content.length / 4)
    };
  }

  throw new GroqRequestError("Groq agent limiti müvəqqəti dolub.", 429);
}

// Groq-un OpenAI uyğun API-dən server tərəfində axınlı cavab alır.
export async function streamGroqChat(messages: ChatMessage[], signal: AbortSignal) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL;
  if (!apiKey || !model) {
    throw new Error("GROQ_API_KEY və GROQ_MODEL server mühitində sazlanmayıb.");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          stream: true,
          messages
        }),
        signal
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new GroqRequestError("Groq xidmətinə qoşulmaq mümkün olmadı.", 503);
    }

    if (response.ok && response.body) return response.body;

    const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
    await response.body?.cancel();
    if (response.status === 429 && attempt < 2) {
      await delay(Math.min(retryAfterMs ?? 300 * 2 ** attempt, 2_000), signal);
      continue;
    }
    throw new GroqRequestError(
      response.status === 429
        ? "Groq sorğu limiti müvəqqəti dolub."
        : `Groq sorğusu uğursuz oldu (${response.status}).`,
      response.status,
      retryAfterMs
    );
  }

  throw new GroqRequestError("Groq xidmətinə hazırda sorğu göndərmək olmur.", 503);
}

async function requestStructuredData<T>(
  input: string,
  schema: z.ZodType<T>,
  systemPrompt: string
): Promise<T> {
  const provider = getProvider();
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!apiKey || !model) {
    throw new Error("AI_API_KEY və AI_MODEL mühit dəyişənləri tələb olunur.");
  }

  const responseText =
    provider === "openai"
      ? await requestOpenAI(apiKey, model, input, systemPrompt)
      : await requestAnthropic(apiKey, model, input, systemPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error("AI provayderi düzgün JSON cavabı qaytarmadı.");
  }

  return schema.parse(parsed);
}

function getProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER;
  if (provider === "openai" || provider === "anthropic") return provider;
  throw new Error("AI_PROVIDER 'openai' və ya 'anthropic' olmalıdır.");
}

function parseRetryAfter(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function delay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}

async function requestOpenAI(apiKey: string, model: string, source: string, systemPrompt: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: source }
      ]
    }),
    signal: AbortSignal.timeout(45_000)
  });
  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(`OpenAI sorğusu uğursuz oldu: ${result.error?.message ?? response.statusText}`);
  }

  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI boş cavab qaytardı.");
  return content;
}

async function requestAnthropic(apiKey: string, model: string, source: string, systemPrompt: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: source }]
    }),
    signal: AbortSignal.timeout(45_000)
  });
  const result = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(
      `Anthropic sorğusu uğursuz oldu: ${result.error?.message ?? response.statusText}`
    );
  }

  const content = result.content?.find((block) => block.type === "text")?.text;
  if (!content) throw new Error("Anthropic boş cavab qaytardı.");
  return content;
}
