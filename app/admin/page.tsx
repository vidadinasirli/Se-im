import type { Metadata } from "next";
import {
  generateQuestionDraftsAction,
  reviewPendingChange,
  reviewQuestion,
  rollbackAgentPage,
  setAgentPageIndexing
} from "@/app/admin/actions";
import {
  importSpecialtiesAction,
  publishSpecialtyAction,
  rejectSpecialtyAction
} from "@/app/admin/specialty-actions";
import {
  approveAndSendNewsletterAction,
  createNewsletterDraftAction,
  rejectNewsletterDraftAction
} from "@/app/newsletter/actions";
import { AgentControlPanel } from "@/app/admin/agent-control-panel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Dəyişikliklərə baxış",
  description: "Gözləyən məzmun dəyişikliklərini nəzərdən keçirin.",
  alternates: { canonical: "/admin" },
  robots: { index: false, follow: false }
};

function formatValue(value: unknown) {
  return JSON.stringify(value, null, 2) ?? "null";
}

export default async function AdminPage() {
  const [
    changes,
    questionDrafts,
    contentGaps,
    agentPages,
    newsletterDrafts,
    confirmedSubscribers,
    specialtyDrafts
  ] = await Promise.all([
    prisma.pendingChange.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" }
    }),
    prisma.question.findMany({
      where: { status: "DRAFT" },
      orderBy: { createdAt: "asc" }
    }),
    prisma.chatLog.findMany({
      where: { result: "NO_CONTEXT" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, question: true, createdAt: true }
    }),
    prisma.agentPage.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50
    }),
    prisma.newsletterDraft.findMany({
      where: { status: { in: ["PENDING_REVIEW", "APPROVED"] } },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.newsletterSubscriber.count({ where: { status: "CONFIRMED" } }),
    prisma.universitySpecialty.findMany({
      where: { published: false },
      orderBy: [{ academicYear: "desc" }, { universityName: "asc" }],
      take: 100
    })
  ]);
  const newsletterDeliveryCounts = await prisma.newsletterDelivery.groupBy({
    by: ["draftId", "status"],
    where: { draftId: { in: newsletterDrafts.map((draft) => draft.id) } },
    _count: { _all: true }
  });
  const deliveryCountByDraft = new Map<string, Record<string, number>>();
  for (const item of newsletterDeliveryCounts) {
    deliveryCountByDraft.set(item.draftId, {
      ...(deliveryCountByDraft.get(item.draftId) ?? {}),
      [item.status]: item._count._all
    });
  }
  const agentRevisions = await prisma.agentPageRevision.findMany({
    where: { pageSlug: { in: agentPages.map((page) => page.slug) } },
    orderBy: [{ pageSlug: "asc" }, { version: "desc" }]
  });
  const revisionsBySlug = new Map<string, typeof agentRevisions>();
  for (const revision of agentRevisions) {
    revisionsBySlug.set(revision.pageSlug, [
      ...(revisionsBySlug.get(revision.pageSlug) ?? []),
      revision
    ]);
  }
  const gapCounts = new Map<string, number>();
  for (const gap of contentGaps) {
    gapCounts.set(gap.question, (gapCounts.get(gap.question) ?? 0) + 1);
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Gözləyən dəyişikliklər</h1>
        <p className="mt-2 text-slate-600">
          Yüksək riskli yenilikləri nəzərdən keçirin və qərarınızı qeyd edin.
        </p>
      </header>

      <AgentControlPanel />

      <section className="mb-10 rounded-xl border border-slate-300 bg-white p-5">
        <h2 className="text-2xl font-bold">DİM ixtisas məlumatlarının idxalı</h2>
        <p className="mt-2 max-w-3xl leading-7 text-slate-700">
          Yalnız DİM-in rəsmi HTTPS ünvanından alınmış CSV faylı idxal edilir. Sətirlər ictimai
          kataloqa dərhal çıxmır; hər birini yoxlayıb ayrıca dərc etməlisiniz.
        </p>
        <a
          href="/ixtisas-sablonu.csv"
          download
          className="mt-3 inline-block font-semibold text-blue-800 underline underline-offset-2"
        >
          CSV sütun şablonunu endir
        </a>
        <form action={importSpecialtiesAction} className="mt-4 grid gap-4 sm:max-w-2xl">
          <div>
            <label htmlFor="specialty-source-url" className="mb-2 block text-sm font-semibold">
              DİM sənədinin rəsmi URL-i
            </label>
            <input
              id="specialty-source-url"
              name="sourceUrl"
              type="url"
              required
              pattern="https://([a-z0-9-]+\\.)*dim\\.gov\\.az/.*"
              placeholder="https://dim.gov.az/..."
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="specialty-csv" className="mb-2 block text-sm font-semibold">
              Rəsmi məlumatdan hazırlanmış CSV
            </label>
            <input
              id="specialty-csv"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className="block min-h-11 w-full rounded-lg border border-slate-300 p-2"
            />
          </div>
          <button className="min-h-11 w-fit rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">
            Qaralama kimi idxal et
          </button>
        </form>

        <h3 className="mt-7 text-lg font-semibold">
          Yoxlanış gözləyir: {specialtyDrafts.length} qeyd
        </h3>
        {specialtyDrafts.length === 0 ? (
          <p className="mt-2 text-slate-600">Dərc olunmamış ixtisas qeydi yoxdur.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {specialtyDrafts.map((program) => (
              <li key={program.id} className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-600">
                  {program.academicYear} · {program.admissionGroup} qəbul qrupu ·{" "}
                  {program.tuitionType === "FREE" ? "Dövlət sifarişli" : "Ödənişli"}
                </p>
                <h4 className="mt-1 font-semibold">{program.specialtyName}</h4>
                <p className="text-slate-700">{program.universityName} · {program.city}</p>
                <p className="mt-2 text-sm">
                  Keçid balı: {program.minimumAdmissionScore ?? "yoxdur"} · İllik təhsil haqqı:{" "}
                  {program.annualTuition === null ? "yoxdur" : `${program.annualTuition} AZN`}
                </p>
                <p className="mt-2 break-all text-xs text-slate-600">Mənbə: {program.sourceUrl}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <form action={publishSpecialtyAction}>
                    <input type="hidden" name="id" value={program.id} />
                    <button className="min-h-10 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
                      Yoxladım, dərc et
                    </button>
                  </form>
                  <form action={rejectSpecialtyAction}>
                    <input type="hidden" name="id" value={program.id} />
                    <button className="min-h-10 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                      Rədd et
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10 rounded-xl border border-slate-300 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Həftəlik e-poçt bülleteni</h2>
            <p className="mt-2 text-slate-700">
              Təsdiqlənmiş abunəçi: {confirmedSubscribers}. Qaralama yayımlanmadan əvvəl yoxlanmalıdır.
            </p>
          </div>
          <form action={createNewsletterDraftAction}>
            <button className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
              Bu həftə üçün qaralama yarat
            </button>
          </form>
        </div>
        {newsletterDrafts.length === 0 ? (
          <p className="mt-5 rounded-lg bg-slate-50 p-4 text-slate-700">
            Yoxlanış gözləyən həftəlik qaralama yoxdur.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {newsletterDrafts.map((draft) => {
              const counts = deliveryCountByDraft.get(draft.id) ?? {};
              return (
                <li key={draft.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm text-slate-600">
                    {draft.weekKey} həftəsi ·{" "}
                    {draft.status === "PENDING_REVIEW" ? "Yoxlanış gözləyir" : "Göndəriş təsdiqlənib"} ·{" "}
                    {counts.SENT ?? 0} göndərildi · {counts.FAILED ?? 0} xəta
                  </p>
                  <h3 className="mt-2 text-lg font-semibold">{draft.subject}</h3>
                  <p className="mt-1 text-sm text-slate-600">{draft.preview}</p>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6">
                    {draft.content}
                  </pre>
                  {Array.isArray(draft.sources) && (
                    <ul className="mt-3 space-y-1 text-sm">
                      {draft.sources.map((rawSource, index) => {
                        if (!rawSource || typeof rawSource !== "object" || Array.isArray(rawSource)) {
                          return null;
                        }
                        const source = rawSource as { title?: unknown; url?: unknown };
                        return typeof source.title === "string" && typeof source.url === "string" ? (
                          <li key={`${draft.id}-${index}`}>
                            Mənbə:{" "}
                            <a className="text-blue-800 underline" href={source.url}>
                              {source.title}
                            </a>
                          </li>
                        ) : null;
                      })}
                    </ul>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <form action={approveAndSendNewsletterAction}>
                      <input type="hidden" name="draftId" value={draft.id} />
                      <button className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
                        {draft.status === "APPROVED"
                          ? "Göndərişləri davam et"
                          : "Yoxladım, təsdiqlə və göndər"}
                      </button>
                    </form>
                    {draft.status === "PENDING_REVIEW" && (
                      <form action={rejectNewsletterDraftAction}>
                        <input type="hidden" name="draftId" value={draft.id} />
                        <button className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">
                          Rədd et
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mb-10 rounded-xl border border-slate-300 bg-white p-5">
        <h2 className="text-2xl font-bold">Agent səhifələrinin versiyaları</h2>
        {agentPages.length === 0 ? (
          <p className="mt-3 text-slate-600">Hələ agent səhifəsi dərc edilməyib.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {agentPages.map((page) => (
              <li key={page.slug} className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-semibold">{page.title}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  /{page.slug === "azn-try-cevirici" ? `valyuta/${page.slug}` : `guide/${page.slug}`} ·{" "}
                  {page.updatedAt.toLocaleString("az-AZ")} ·{" "}
                  {page.noindex ? "axtarışda gizlidir" : "axtarış üçün açıqdır"}
                </p>
                <form action={setAgentPageIndexing} className="mt-3">
                  <input type="hidden" name="slug" value={page.slug} />
                  <input type="hidden" name="noindex" value={String(!page.noindex)} />
                  <button className="min-h-10 rounded border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                    {page.noindex ? "Axtarış sistemlərində göstər" : "İndekslənmədən çıxar"}
                  </button>
                </form>
                {(revisionsBySlug.get(page.slug) ?? []).length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">Əvvəlki versiya yoxdur.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {(revisionsBySlug.get(page.slug) ?? []).map((revision) => (
                      <li
                        key={revision.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded bg-slate-50 p-3"
                      >
                        <span className="text-sm">
                          Versiya {revision.version} · {revision.createdAt.toLocaleString("az-AZ")} ·{" "}
                          {revision.title}
                        </span>
                        <form action={rollbackAgentPage}>
                          <input type="hidden" name="slug" value={page.slug} />
                          <input type="hidden" name="version" value={revision.version} />
                          <button className="min-h-10 rounded border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                            Bu versiyanı bərpa et
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10 rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="text-xl font-semibold">Riyaziyyat sualları</h2>
        <p className="mt-2 text-slate-700">
          AI-nın hazırladığı suallar qaralama kimi saxlanır; yayımlanmadan əvvəl cavabı və izahı yoxlayın.
        </p>
        <form action={generateQuestionDraftsAction} className="mt-4">
          <button className="min-h-11 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
            Sual istehsal et
          </button>
        </form>
        {questionDrafts.length === 0 ? (
          <p className="mt-5 rounded-lg bg-white p-4 text-slate-700">
            Yoxlanış gözləyən sual yoxdur.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {questionDrafts.map((question) => (
              <li key={question.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-blue-800">
                  {question.subject} · {question.grade}-cu sinif · {question.topic} · {question.difficulty}
                </p>
                <h3 className="mt-2 font-semibold">{question.prompt}</h3>
                <ol className="mt-3 list-inside list-[upper-alpha] space-y-1 text-sm">
                  {Array.isArray(question.options) &&
                    question.options.map((option, index) => (
                      <li
                        key={index}
                        className={index === question.correctIndex ? "font-semibold text-emerald-800" : ""}
                      >
                        {String(option)}
                        {index === question.correctIndex ? " — düzgün cavab" : ""}
                      </li>
                    ))}
                </ol>
                <p className="mt-3 text-sm text-slate-700">
                  <strong>İzah:</strong> {question.explanation}
                </p>
                <form action={reviewQuestion} className="mt-4 flex flex-wrap gap-3">
                  <input type="hidden" name="id" value={question.id} />
                  <button
                    className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                    name="decision"
                    value="approve"
                  >
                    Yoxladım, yayımla
                  </button>
                  <button
                    className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                    name="decision"
                    value="reject"
                  >
                    Rədd et
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-xl font-semibold">Məzmun boşluqları</h2>
        <p className="mt-2 text-slate-700">
          Assistentin saytda cavab tapa bilmədiyi, şəxsi məlumatları gizlədilmiş suallar.
          Təkrarlanan suallar yeni bələdçi səhifəsi üçün faydalı mövzu siqnalıdır.
        </p>
        {contentGaps.length === 0 ? (
          <p className="mt-4 rounded-lg bg-white p-4 text-slate-700">
            Hələ cavabsız sual yoxdur.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {[...gapCounts.entries()]
              .sort(([, first], [, second]) => second - first)
              .map(([question, count]) => (
                <li key={question} className="rounded-lg bg-white p-4">
                  <p className="font-medium">{question}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {count} dəfə soruşulub; son sorğu{" "}
                    {contentGaps.find((gap) => gap.question === question)?.createdAt.toLocaleString("az-AZ")}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>

      <h2 className="mb-5 text-2xl font-bold">Gözləyən dəyişikliklər</h2>
      {changes.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">
          Nəzərdən keçiriləcək dəyişiklik yoxdur.
        </p>
      ) : (
        <ul className="space-y-6">
          {changes.map((change) => (
            <li key={change.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{change.contentKey}</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
                  {change.riskLevel === "HIGH" ? "Yüksək risk" : "Aşağı risk"}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Etibar: {Math.round(change.confidence * 100)}% ·{" "}
                {change.createdAt.toLocaleString("az-AZ")}
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <ValuePanel title="Əvvəlki dəyər" value={formatValue(change.oldValue)} />
                <ValuePanel title="Yeni dəyər" value={formatValue(change.newValue)} />
              </div>
              <p className="mt-4 break-all text-sm">
                Mənbə:{" "}
                <a
                  className="text-blue-700 underline underline-offset-2"
                  href={change.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {change.sourceUrl}
                </a>
              </p>
              <form action={reviewPendingChange} className="mt-5 flex flex-wrap gap-3">
                <input type="hidden" name="id" value={change.id} />
                <button
                  className="min-h-11 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  name="decision"
                  value="approve"
                >
                  Təsdiqlə və yayımla
                </button>
                <button
                  className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                  name="decision"
                  value="reject"
                >
                  Rədd et
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ValuePanel({ title, value }: { title: string; value: string }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      <pre className="min-h-24 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm">
        {value}
      </pre>
    </section>
  );
}
