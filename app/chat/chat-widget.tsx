"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type SourceLink = { title: string; url: string };
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  chatId?: string;
  sources?: SourceLink[];
  suggestions?: SourceLink[];
  feedback?: "UP" | "DOWN";
  failed?: boolean;
};

// Mobil ekranda tam enə açılan, axınlı cavab verən köməkçi panelidir.
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = message.trim();
    if (!question || sending) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text: question };
    const assistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: "assistant", text: "" }
    ]);
    setMessage("");
    setError("");
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question })
      });

      if (!response.ok || !response.body) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error ?? "Mesaj göndərilmədi. Bir az sonra yenidən cəhd edin.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const handleEvent = (block: string) => {
        const eventName = block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
        const dataLine = block.match(/^data:\s*(.+)$/m)?.[1];
        if (!eventName || !dataLine) return;
        const payload = JSON.parse(dataLine) as {
          chatId?: string;
          text?: string;
          message?: string;
          items?: SourceLink[];
          suggestions?: SourceLink[];
        };
        if (eventName === "meta" && payload.chatId) {
          setMessages((current) =>
            current.map((entry) =>
              entry.id === assistantId ? { ...entry, chatId: payload.chatId } : entry
            )
          );
        } else if (eventName === "token" && payload.text) {
          setMessages((current) =>
            current.map((entry) =>
              entry.id === assistantId ? { ...entry, text: entry.text + payload.text } : entry
            )
          );
        } else if (eventName === "sources" && payload.items) {
          setMessages((current) =>
            current.map((entry) =>
              entry.id === assistantId
                ? { ...entry, sources: payload.items, suggestions: payload.suggestions }
                : entry
            )
          );
        } else if (eventName === "error" && payload.message) {
          setMessages((current) =>
            current.map((entry) =>
              entry.id === assistantId
                ? { ...entry, text: payload.message ?? "", chatId: undefined, failed: true }
                : entry
            )
          );
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) handleEvent(block);
      }
      if (buffer.trim()) handleEvent(buffer);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Assistentə qoşulmaq mümkün olmadı. Bir az sonra yenidən cəhd edin."
      );
      setMessages((current) => current.filter((entry) => entry.id !== assistantId || entry.text));
    } finally {
      setSending(false);
    }
  }

  async function sendFeedback(chatId: string, feedback: "UP" | "DOWN") {
    const response = await fetch("/api/chat/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, feedback })
    });
    if (!response.ok) {
      setError("Rəyinizi saxlamaq mümkün olmadı.");
      return;
    }
    setMessages((current) =>
      current.map((entry) => (entry.chatId === chatId ? { ...entry, feedback } : entry))
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {open && (
        <section
          id="chat-widget"
          aria-label="AI söhbət köməkçisi"
          className="mb-3 flex h-[min(70vh,620px)] w-[min(calc(100vw-2rem),400px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between gap-3 bg-blue-800 px-4 py-3 text-white">
            <div>
              <h2 className="font-semibold">Hazırlıq köməkçisi</h2>
              <p className="text-xs text-blue-100">Saytımızdakı məlumatlar əsasında cavab verir</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Söhbəti bağla"
              className="grid size-10 place-items-center rounded-full text-xl hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-white"
            >
              ×
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4" aria-live="polite">
            {messages.length === 0 && (
              <p className="rounded-xl bg-white p-4 text-sm leading-6 text-slate-700">
                Salam! İmtahan təqvimi və saytdakı dərs materialları barədə sual verə bilərsiniz.
              </p>
            )}
            {messages.map((entry) => (
              <article
                key={entry.id}
                className={`max-w-[92%] rounded-xl p-3 text-sm leading-6 ${
                  entry.role === "user"
                    ? "ml-auto bg-blue-700 text-white"
                    : "mr-auto border border-slate-200 bg-white text-slate-800"
                }`}
              >
                {entry.text ? (
                  <p className="whitespace-pre-wrap break-words">{entry.text}</p>
                ) : sending ? (
                  <p className="text-slate-500">Cavab hazırlanır…</p>
                ) : null}
                {entry.sources && entry.sources.length > 0 && (
                  <div className="mt-3 border-t border-slate-200 pt-2">
                    <p className="text-xs font-semibold">İstifadə olunan səhifələr:</p>
                    <ul className="mt-1 list-inside list-disc">
                      {entry.sources.map((source) => (
                        <li key={source.url}>
                          <a
                            href={source.url}
                            className="text-blue-800 underline underline-offset-2"
                          >
                            {source.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {entry.suggestions && entry.suggestions.length > 0 && (
                  <div className="mt-3 border-t border-slate-200 pt-2">
                    <p className="text-xs font-semibold">Əlaqəli səhifələr:</p>
                    <ul className="mt-1 list-inside list-disc">
                      {entry.suggestions.map((source) => (
                        <li key={source.url}>
                          <a
                            href={source.url}
                            className="text-blue-800 underline underline-offset-2"
                          >
                            {source.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {entry.role === "assistant" && entry.chatId && entry.text && !entry.failed && (
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-2">
                    <span className="mr-1 text-xs text-slate-500">Cavab faydalı oldumu?</span>
                    {(["UP", "DOWN"] as const).map((feedback) => (
                      <button
                        key={feedback}
                        type="button"
                        onClick={() => sendFeedback(entry.chatId!, feedback)}
                        disabled={Boolean(entry.feedback)}
                        aria-label={feedback === "UP" ? "Faydalı cavab" : "Faydasız cavab"}
                        aria-pressed={entry.feedback === feedback}
                        className="min-h-9 min-w-9 rounded-md border border-slate-300 disabled:opacity-60"
                      >
                        {feedback === "UP" ? "👍" : "👎"}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
            <div ref={endRef} />
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs leading-5 text-slate-600">
              {error || "Şəxsi məlumat, FIN kodu, telefon nömrəsi və ya şifrə yazmayın."}
            </p>
            <form onSubmit={sendMessage} className="flex items-end gap-2">
              <label className="sr-only" htmlFor="assistant-message">
                Sualınızı yazın
              </label>
              <textarea
                id="assistant-message"
                ref={inputRef}
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, 2_000))}
                maxLength={2_000}
                rows={2}
                placeholder="Sualınızı yazın…"
                disabled={sending}
                className="min-h-12 flex-1 resize-none rounded-lg border border-slate-300 p-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
              />
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="min-h-12 rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Göndər
              </button>
            </form>
          </div>
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="chat-widget"
        aria-label={open ? "Söhbəti bağla" : "AI köməkçisi ilə söhbət et"}
        className="ml-auto flex min-h-14 items-center gap-2 rounded-full bg-blue-800 px-5 font-semibold text-white shadow-lg hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        <span aria-hidden="true">✦</span>
        <span>{open ? "Bağla" : "Sual ver"}</span>
      </button>
    </div>
  );
}
