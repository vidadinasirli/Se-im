"use client";

import { useEffect, useMemo, useState } from "react";

type Question = {
  id: string;
  topic: string;
  difficulty: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type SavedAnswer = { selectedIndex: number; correct: boolean };
type AnswerMap = Record<string, SavedAnswer>;

// Cavabları yalnız cari brauzerdə saxlayır və mövzu statistikasını hesablayır.
export function QuestionSet({
  groupSlug,
  questions
}: {
  groupSlug: string;
  questions: Question[];
}) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");

  const storageKey = `imtahan-cavablari:${groupSlug}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const questionsById = new Map(questions.map((question) => [question.id, question]));
          const validAnswers: AnswerMap = {};
          for (const [id, value] of Object.entries(parsed)) {
            const question = questionsById.get(id);
            const selectedIndex =
              value && typeof value === "object"
                ? (value as Record<string, unknown>).selectedIndex
                : null;
            if (
              question &&
              typeof selectedIndex === "number" &&
              Number.isInteger(selectedIndex) &&
              selectedIndex >= 0 &&
              selectedIndex < question.options.length
            ) {
              validAnswers[id] = {
                selectedIndex,
                correct: selectedIndex === question.correctIndex
              };
            }
          }
          setAnswers(validAnswers);
        }
      }
    } catch {
      setStorageError("Bu brauzerdə nəticələri saxlamaq mümkün olmadı.");
    } finally {
      setReady(true);
    }
  }, [questions, storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch {
      setStorageError("Bu brauzerdə nəticələri saxlamaq mümkün olmadı.");
    }
  }, [answers, ready, storageKey]);

  const topicStats = useMemo(() => {
    const stats = new Map<string, { total: number; correct: number }>();
    for (const question of questions) {
      const answer = answers[question.id];
      if (!answer) continue;
      const current = stats.get(question.topic) ?? { total: 0, correct: 0 };
      current.total += 1;
      if (answer.correct) current.correct += 1;
      stats.set(question.topic, current);
    }
    return [...stats.entries()].sort(
      ([, first], [, second]) => first.correct / first.total - second.correct / second.total
    );
  }, [answers, questions]);

  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter((answer) => answer.correct).length;

  function chooseAnswer(question: Question, selectedIndex: number) {
    if (answers[question.id]) return;
    setAnswers((current) => ({
      ...current,
      [question.id]: {
        selectedIndex,
        correct: selectedIndex === question.correctIndex
      }
    }));
  }

  return (
    <section>
      <div
        className="mb-6 rounded-xl border border-slate-200 bg-white p-5"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="text-lg font-semibold">
          Nəticə: {correctCount} / {answeredCount} düzgün cavab
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {ready ? "İrəliləyişiniz bu brauzerdə saxlanılır." : "Nəticələr yüklənir…"}
        </p>
        {storageError && <p className="mt-2 text-sm text-red-700">{storageError}</p>}
      </div>

      {topicStats.length > 0 && (
        <section
          aria-labelledby="topic-progress-heading"
          className="mb-8 rounded-xl border border-slate-200 bg-white p-5"
        >
          <h2 id="topic-progress-heading" className="text-lg font-semibold">
            Mövzular üzrə irəliləyiş
          </h2>
          <ul className="mt-4 space-y-4">
            {topicStats.map(([topic, stats]) => {
              const percentage = Math.round((stats.correct / stats.total) * 100);
              return (
                <li key={topic}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span>{topic}</span>
                    <span>
                      {stats.correct}/{stats.total} düzgün · {percentage}%
                    </span>
                  </div>
                  <div
                    className="h-3 overflow-hidden rounded-full bg-slate-200"
                    role="img"
                    aria-label={`${topic}: ${percentage}% düzgün cavab`}
                  >
                    <div
                      className={`h-full rounded-full ${percentage < 60 ? "bg-amber-500" : "bg-emerald-600"}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  {percentage < 60 && (
                    <p className="mt-1 text-sm font-medium text-amber-800">
                      Bu mövzunu yenidən təkrarlayın.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ol className="space-y-5">
        {questions.map((question, questionIndex) => {
          const answer = answers[question.id];
          return (
            <li key={question.id} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <p className="text-sm font-semibold text-blue-800">
                Sual {questionIndex + 1} · {question.topic} · {question.difficulty.toLocaleLowerCase("az")}
              </p>
              <h2 className="mt-3 text-lg font-semibold leading-7">{question.prompt}</h2>
              <fieldset className="mt-4 space-y-2">
                <legend className="sr-only">Cavab variantları</legend>
                {question.options.map((option, optionIndex) => {
                  const selected = answer?.selectedIndex === optionIndex;
                  const isCorrectOption = question.correctIndex === optionIndex;
                  const stateClass = answer
                    ? isCorrectOption
                      ? "border-emerald-600 bg-emerald-50 text-emerald-950"
                      : selected
                        ? "border-red-500 bg-red-50 text-red-950"
                        : "border-slate-200"
                    : "border-slate-200 hover:border-blue-500 hover:bg-blue-50";
                  return (
                    <label
                      key={`${question.id}-${optionIndex}`}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 ${stateClass}`}
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={optionIndex}
                        checked={selected}
                        disabled={!ready || Boolean(answer)}
                        onChange={() => chooseAnswer(question, optionIndex)}
                        className="size-4 accent-blue-700"
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </fieldset>
              {answer && (
                <div
                  className={`mt-4 rounded-lg p-4 ${answer.correct ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950"}`}
                  aria-live="polite"
                >
                  <p className="font-semibold">
                    {answer.correct ? "Düzgün cavabdır!" : "Bu cavab düzgün deyil."}
                  </p>
                  <p className="mt-2 leading-7">
                    <strong>İzah:</strong> {question.explanation}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
