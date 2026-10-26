-- Initial PostgreSQL schema for the production database.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'HIGH');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExamEventType" AS ENUM ('BURAXILIS', 'BLOK', 'QEBUL', 'OTHER');

-- CreateEnum
CREATE TYPE "SignalSource" AS ENUM ('GA4', 'SEARCH_CONSOLE', 'GOOGLE_TRENDS', 'SITE_SEARCH', 'CHAT_GAP', 'CENTRAL_BANK', 'DIM');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('CANDIDATE', 'PROCESSING', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentLogLevel" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "TuitionType" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "NewsletterSubscriberStatus" AS ENUM ('PENDING', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "NewsletterDraftStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'SENT', 'REJECTED');

-- CreateEnum
CREATE TYPE "NewsletterDeliveryStatus" AS ENUM ('SENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingChange" (
    "id" TEXT NOT NULL,
    "contentKey" TEXT NOT NULL,
    "oldValue" JSONB NOT NULL,
    "newValue" JSONB NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "status" "ChangeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "PendingChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeLog" (
    "id" TEXT NOT NULL,
    "contentKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB NOT NULL,
    "newValue" JSONB NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "groupSlug" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ExamEventType" NOT NULL,
    "eventDate" TIMESTAMP(3),
    "applicationDeadline" TIMESTAMP(3),
    "description" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniversitySpecialty" (
    "id" TEXT NOT NULL,
    "universityName" TEXT NOT NULL,
    "specialtyName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "admissionGroup" TEXT NOT NULL,
    "admissionSubgroup" TEXT,
    "tuitionType" "TuitionType" NOT NULL,
    "minimumAdmissionScore" DOUBLE PRECISION,
    "annualTuition" INTEGER,
    "academicYear" INTEGER NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UniversitySpecialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "NewsletterSubscriberStatus" NOT NULL DEFAULT 'PENDING',
    "confirmationTokenHash" TEXT,
    "unsubscribeToken" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterDraft" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "status" "NewsletterDraftStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "NewsletterDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterDelivery" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "status" "NewsletterDeliveryStatus" NOT NULL DEFAULT 'SENDING',
    "providerMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatLog" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answered" BOOLEAN NOT NULL DEFAULT false,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRateLimit" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSearchDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSearchDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "source" "SignalSource" NOT NULL,
    "topic" TEXT NOT NULL,
    "rawValue" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "opportunityId" TEXT,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "topicKey" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'CANDIDATE',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "decision" JSONB,
    "reason" TEXT,
    "sourceUrls" JSONB NOT NULL,
    "pageSlug" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processingStartedAt" TIMESTAMP(3),

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL,
    "level" "AgentLogLevel" NOT NULL DEFAULT 'INFO',
    "stage" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "signalId" TEXT,
    "opportunityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishPolicy" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "killSwitch" BOOLEAN NOT NULL DEFAULT false,
    "maxPagesPerDay" INTEGER NOT NULL DEFAULT 5,
    "maxPagesPerHour" INTEGER NOT NULL DEFAULT 2,
    "minimumConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "similarityLimit" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "minimumContentChars" INTEGER NOT NULL DEFAULT 600,
    "dailyTokenBudget" INTEGER NOT NULL DEFAULT 100000,
    "tokensUsedToday" INTEGER NOT NULL DEFAULT 0,
    "usageDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "structuredData" JSONB,
    "sourceUrl" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "factCheckPassed" BOOLEAN NOT NULL DEFAULT false,
    "autoPublished" BOOLEAN NOT NULL DEFAULT false,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPageRevision" (
    "id" TEXT NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "structuredData" JSONB,
    "riskLevel" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "factCheckPassed" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPageRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentUsage" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentExecutionLock" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentExecutionLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSearchLog" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteSearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_key_key" ON "ContentItem"("key");

-- CreateIndex
CREATE INDEX "ContentItem_updatedAt_idx" ON "ContentItem"("updatedAt");

-- CreateIndex
CREATE INDEX "PendingChange_status_createdAt_idx" ON "PendingChange"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PendingChange_contentKey_idx" ON "PendingChange"("contentKey");

-- CreateIndex
CREATE INDEX "JobLog_jobName_createdAt_idx" ON "JobLog"("jobName", "createdAt");

-- CreateIndex
CREATE INDEX "ChangeLog_contentKey_createdAt_idx" ON "ChangeLog"("contentKey", "createdAt");

-- CreateIndex
CREATE INDEX "Question_groupSlug_status_idx" ON "Question"("groupSlug", "status");

-- CreateIndex
CREATE INDEX "Question_status_createdAt_idx" ON "Question"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ExamEvent_eventDate_idx" ON "ExamEvent"("eventDate");

-- CreateIndex
CREATE INDEX "UniversitySpecialty_published_academicYear_idx" ON "UniversitySpecialty"("published", "academicYear");

-- CreateIndex
CREATE INDEX "UniversitySpecialty_city_admissionGroup_tuitionType_idx" ON "UniversitySpecialty"("city", "admissionGroup", "tuitionType");

-- CreateIndex
CREATE INDEX "UniversitySpecialty_universityName_specialtyName_idx" ON "UniversitySpecialty"("universityName", "specialtyName");

-- CreateIndex
CREATE UNIQUE INDEX "UniversitySpecialty_universityName_specialtyName_city_admis_key" ON "UniversitySpecialty"("universityName", "specialtyName", "city", "admissionGroup", "tuitionType", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_confirmationTokenHash_key" ON "NewsletterSubscriber"("confirmationTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_unsubscribeToken_key" ON "NewsletterSubscriber"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "NewsletterSubscriber_status_createdAt_idx" ON "NewsletterSubscriber"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterDraft_weekKey_key" ON "NewsletterDraft"("weekKey");

-- CreateIndex
CREATE INDEX "NewsletterDraft_status_createdAt_idx" ON "NewsletterDraft"("status", "createdAt");

-- CreateIndex
CREATE INDEX "NewsletterDelivery_draftId_status_idx" ON "NewsletterDelivery"("draftId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterDelivery_draftId_subscriberId_key" ON "NewsletterDelivery"("draftId", "subscriberId");

-- CreateIndex
CREATE INDEX "ChatLog_answered_createdAt_idx" ON "ChatLog"("answered", "createdAt");

-- CreateIndex
CREATE INDEX "ChatLog_feedback_createdAt_idx" ON "ChatLog"("feedback", "createdAt");

-- CreateIndex
CREATE INDEX "ChatRateLimit_expiresAt_idx" ON "ChatRateLimit"("expiresAt");

-- CreateIndex
CREATE INDEX "ChatSearchDocument_updatedAt_idx" ON "ChatSearchDocument"("updatedAt");

-- CreateIndex
CREATE INDEX "Signal_source_observedAt_idx" ON "Signal"("source", "observedAt");

-- CreateIndex
CREATE INDEX "Signal_topic_observedAt_idx" ON "Signal"("topic", "observedAt");

-- CreateIndex
CREATE INDEX "Signal_opportunityId_idx" ON "Signal"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_topicKey_key" ON "Opportunity"("topicKey");

-- CreateIndex
CREATE INDEX "Opportunity_status_score_idx" ON "Opportunity"("status", "score");

-- CreateIndex
CREATE INDEX "Opportunity_lastSeenAt_idx" ON "Opportunity"("lastSeenAt");

-- CreateIndex
CREATE INDEX "AgentLog_createdAt_idx" ON "AgentLog"("createdAt");

-- CreateIndex
CREATE INDEX "AgentLog_stage_createdAt_idx" ON "AgentLog"("stage", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPage_slug_key" ON "AgentPage"("slug");

-- CreateIndex
CREATE INDEX "AgentPage_publishedAt_idx" ON "AgentPage"("publishedAt");

-- CreateIndex
CREATE INDEX "AgentPage_noindex_publishedAt_idx" ON "AgentPage"("noindex", "publishedAt");

-- CreateIndex
CREATE INDEX "AgentPageRevision_pageSlug_createdAt_idx" ON "AgentPageRevision"("pageSlug", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPageRevision_pageSlug_version_key" ON "AgentPageRevision"("pageSlug", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AgentUsage_requestKey_key" ON "AgentUsage"("requestKey");

-- CreateIndex
CREATE INDEX "AgentUsage_createdAt_idx" ON "AgentUsage"("createdAt");

-- CreateIndex
CREATE INDEX "SiteSearchLog_createdAt_idx" ON "SiteSearchLog"("createdAt");

-- AddForeignKey
ALTER TABLE "NewsletterDelivery" ADD CONSTRAINT "NewsletterDelivery_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "NewsletterDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterDelivery" ADD CONSTRAINT "NewsletterDelivery_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "NewsletterSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
