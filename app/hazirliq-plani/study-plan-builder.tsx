"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type StudyPlanSubject = {
  id: string;
  label: string;
  subject: string;
  grade: number;
  topics: string[];
  testUrl: string;
};

type PlanConfig = {
  duration: 30 | 60 | 90;
  daysPerWeek: number;
  startDate: string;
  subjectIds: string[];
};

type SavedPlan = {
  config: PlanConfig;
  completed: string[];
};

type StudyDay = {
  dayNumber: number;
  date: Date;
  subject: StudyPlanSubject | null;
  topic: string | null;
  review: boolean;
};

const storageKey = "abituriyent-hazirliq-plani-v1";
const dateFormatter = new Intl.DateTimeFormat("az-AZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC"
});
const durations = [30, 60, 90] as const;

function isPlanConfig(value: unknown, subjects: StudyPlanSubject[]): value is PlanConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.duration === 30 || candidate.duration === 60 || candidate.duration === 90) &&
    typeof candidate.daysPerWeek === "number" &&
    Number.isInteger(candidate.daysPerWeek) &&
    candidate.daysPerWeek >= 3 &&
    candidate.daysPerWeek <= 6 &&
    typeof candidate.startDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.startDate) &&
    Array.isArray(candidate.subjectIds) &&
    candidate.subjectIds.length > 0 &&
    candidate.subjectIds.every(
      (id): id is string => typeof id === "string" && subjects.some((subject) => subject.id === id)
    )
  );
}

function addDays(startDate: string, offset: number): Date {
  const [year, month, day] = startDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset));
}

function getDayKey(dayNumber: number): string {
  return `day-${dayNumber}`;
}

function makePlan(config: PlanConfig, subjects: StudyPlanSubject[]): StudyDay[] {
  const selectedSubjects = subjects.filter((subject) => config.subjectIds.includes(subject.id));
  let studyDayNumber = 0;

  return Array.from({ length: config.duration }, (_, index) => {
    const dayNumber = index + 1;
    const weekdayInCycle = index % 7;
    if (weekdayInCycle >= config.daysPerWeek) {
      return {
        dayNumber,
        date: addDays(config.startDate, index),
        subject: null,
        topic: null,
        review: false
      };
    }

    studyDayNumber += 1;
    const subject = selectedSubjects[(studyDayNumber - 1) % selectedSubjects.length];
    const topicIndex = Math.floor((studyDayNumber - 1) / selectedSubjects.length) % subject.topics.length;
    const review = studyDayNumber % (config.daysPerWeek * 2) === 0;

    return {
      dayNumber,
      date: addDays(config.startDate, index),
      subject,
      topic: subject.topics[topicIndex],
      review
    };
  });
}

// Loads and saves the plan only in the visitor's browser.
export function StudyPlanBuilder({ subjects }: { subjects: StudyPlanSubject[] }) {
  const [duration, setDuration] = useState<30 | 60 | 90>(30);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [startDate, setStartDate] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [plan, setPlan] = useState<SavedPlan | null>(null);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          const candidate = parsed as Record<string, unknown>;
          if (isPlanConfig(candidate.config, subjects)) {
            const completed = Array.isArray(candidate.completed)
              ? candidate.completed.filter(
                  (item): item is string =>
                    typeof item === "string" && /^day-\d+$/.test(item)
                )
              : [];
            const nextPlan = {
              config: candidate.config,
              completed: [...new Set(completed)]
            };
            setPlan(nextPlan);
            setDuration(nextPlan.config.duration);
            setDaysPerWeek(nextPlan.config.daysPerWeek);
            setStartDate(nextPlan.config.startDate);
            setSubjectIds(nextPlan.config.subjectIds);
          }
        }
      }
      if (!saved && subjects.length > 0) {
        setSubjectIds(subjects.map((subject) => subject.id));
      }
    } catch {
      setStorageError("Planı bu brauzerdə saxlamaq mümkün olmadı.");
      if (subjects.length > 0) setSubjectIds(subjects.map((subject) => subject.id));
    } finally {
      setReady(true);
    }
  }, [subjects]);

  useEffect(() => {
    if (!ready || !plan) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(plan));
      setStorageError("");
    } catch {
      setStorageError("Planı bu brauzerdə saxlamaq mümkün olmadı.");
    }
  }, [plan, ready]);

  const planDays = useMemo(
    () => (plan ? makePlan(plan.config, subjects) : []),
    [plan, subjects]
  );
  const completedCount = plan?.completed.length ?? 0;
  const studyDays = planDays.filter((day) => day.subject !== null).length;
  const weeks = useMemo(() => {
    const result: StudyDay[][] = [];
    for (let index = 0; index < planDays.length; index += 7) {
      result.push(planDays.slice(index, index + 7));
    }
    return result;
  }, [planDays]);

  function toggleSubject(id: string) {
    setSubjectIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!startDate) {
      setFormError("Planın başlanğıc tarixini seç.");
      return;
    }
    if (!subjectIds.length) {
      setFormError("Plan üçün ən azı bir fənn seç.");
      return;
    }
    setFormError("");
    setPlan({
      config: { duration, daysPerWeek, startDate, subjectIds },
      completed: []
    });
  }

  function toggleCompleted(dayNumber: number) {
    const key = getDayKey(dayNumber);
    setPlan((current) => {
      if (!current) return current;
      return {
        ...current,
        completed: current.completed.includes(key)
          ? current.completed.filter((item) => item !== key)
          : [...current.completed, key]
      };
    });
  }

  if (subjects.length === 0) {
    return (
      <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold">Hazırlıq mövzuları hələ əlavə edilməyib</h2>
        <p className="mt-2 leading-7 text-slate-700">
          Fənn seçimi və plan qurucusu təsdiqlənmiş test mövzuları əlavə edildikdən sonra aktiv olacaq.
          Hələlik{" "}
          <Link
            className="font-semibold text-blue-800 underline underline-offset-2"
            href="/testler/riyaziyyat-9-cu-sinif-cebr"
          >
            Riyaziyyat testlərinə
          </Link>{" "}
          baxa bilərsən.
        </p>
      </section>
    );
  }

  return (
    <div className="mt-8">
      <form
        onSubmit={createPlan}
        className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <fieldset>
          <legend className="text-sm font-semibold">Plan müddəti</legend>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {durations.map((days) => (
              <label
                key={days}
                className={`cursor-pointer rounded-lg border p-3 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-700 ${
                  duration === days ? "border-blue-700 bg-blue-50" : "border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="duration"
                  value={days}
                  checked={duration === days}
                  onChange={() => setDuration(days)}
                  className="sr-only"
                />
                <span className="block text-lg font-bold">{days} gün</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">Fənn seç</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {subjects.map((subject) => (
              <label
                key={subject.id}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 p-3 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={subjectIds.includes(subject.id)}
                  onChange={() => toggleSubject(subject.id)}
                  className="size-4 accent-blue-700"
                />
                <span className="font-medium">{subject.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="days-per-week" className="mb-2 block text-sm font-semibold">
              Həftədə dərs günü
            </label>
            <select
              id="days-per-week"
              value={daysPerWeek}
              onChange={(event) => setDaysPerWeek(Number(event.target.value))}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {[3, 4, 5, 6].map((days) => (
                <option key={days} value={days}>
                  Həftədə {days} gün
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="start-date" className="mb-2 block text-sm font-semibold">
              Başlanğıc tarixi
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            />
          </div>
        </div>

        {formError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
            {formError}
          </p>
        )}
        <button
          type="submit"
          disabled={!ready}
          className="min-h-12 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Planı yarat
        </button>
        <p className="text-sm text-slate-600">
          Plan və tamamlanma qeydləri hesaba bağlanmır; yalnız bu brauzerin yaddaşında saxlanır.
        </p>
      </form>

      {storageError && (
        <p role="status" className="mt-3 text-sm text-red-700">
          {storageError}
        </p>
      )}

      {plan && (
        <section aria-live="polite" className="mt-8">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h2 className="text-xl font-bold">{plan.config.duration} günlük hazırlıq planı</h2>
            <p className="mt-2 leading-7 text-slate-700">
              {dateFormatter.format(addDays(plan.config.startDate, 0))} tarixində başlayır · həftədə{" "}
              {plan.config.daysPerWeek} dərs günü · {studyDays} dərs günü
            </p>
            <div className="mt-4">
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span>İrəliləyiş</span>
                <span>
                  {completedCount}/{studyDays} gün ·{" "}
                  {studyDays ? Math.round((completedCount / studyDays) * 100) : 0}%
                </span>
              </div>
              <div
                className="h-3 overflow-hidden rounded-full bg-white"
                role="img"
                aria-label={`Plan üzrə ${studyDays ? Math.round((completedCount / studyDays) * 100) : 0}% irəliləyiş`}
              >
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width]"
                  style={{
                    width: `${studyDays ? Math.round((completedCount / studyDays) * 100) : 0}%`
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {weeks.map((week, weekIndex) => (
              <details
                key={weekIndex}
                open={weekIndex === 0}
                className="rounded-xl border border-slate-200 bg-white"
              >
                <summary className="cursor-pointer p-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                  {weekIndex + 1}-ci həftə
                </summary>
                <ol className="space-y-3 border-t border-slate-200 p-4">
                  {week.map((day) => (
                    <li
                      key={day.dayNumber}
                      className="rounded-lg border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-blue-800">
                            {day.dayNumber}-ci gün · {dateFormatter.format(day.date)}
                          </p>
                          <h3 className="mt-1 font-semibold">
                            {day.subject
                              ? day.review
                                ? `Təkrar: ${day.topic}`
                                : `${day.subject.subject}: ${day.topic}`
                              : "İstirahət və mövzuları möhkəmləndirmə"}
                          </h3>
                        </div>
                        {day.subject && (
                          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium">
                            <input
                              type="checkbox"
                              checked={plan.completed.includes(getDayKey(day.dayNumber))}
                              onChange={() => toggleCompleted(day.dayNumber)}
                              className="size-4 accent-emerald-700"
                            />
                            Tamamlandı
                          </label>
                        )}
                      </div>
                      {day.subject && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
                          <p>
                            Mövzunu təkrar et, test həll et və səhv cavablarını izahı ilə yoxla.
                          </p>
                          <Link
                            className="font-semibold text-blue-800 underline underline-offset-2"
                            href={day.subject.testUrl}
                          >
                            Testlərə keç
                          </Link>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
