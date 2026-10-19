-- Admin AI Agent schema additions; preserve the existing FTS5 virtual tables.
-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "rawValue" JSONB NOT NULL,
    "observedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" REAL NOT NULL DEFAULT 0,
    "opportunityId" TEXT
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicKey" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "score" REAL NOT NULL DEFAULT 0,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "decision" JSONB,
    "reason" TEXT,
    "sourceUrls" JSONB NOT NULL,
    "pageSlug" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "processingStartedAt" DATETIME
);

-- CreateTable
CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "stage" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "signalId" TEXT,
    "opportunityId" TEXT,
    "details" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PublishPolicy" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "killSwitch" BOOLEAN NOT NULL DEFAULT false,
    "maxPagesPerDay" INTEGER NOT NULL DEFAULT 5,
    "maxPagesPerHour" INTEGER NOT NULL DEFAULT 2,
    "minimumConfidence" REAL NOT NULL DEFAULT 0.85,
    "similarityLimit" REAL NOT NULL DEFAULT 0.7,
    "minimumContentChars" INTEGER NOT NULL DEFAULT 600,
    "dailyTokenBudget" INTEGER NOT NULL DEFAULT 100000,
    "tokensUsedToday" INTEGER NOT NULL DEFAULT 0,
    "usageDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "structuredData" JSONB,
    "sourceUrl" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "factCheckPassed" BOOLEAN NOT NULL DEFAULT false,
    "autoPublished" BOOLEAN NOT NULL DEFAULT false,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentPageRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "structuredData" JSONB,
    "riskLevel" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "factCheckPassed" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AgentUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestKey" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AgentExecutionLock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "lockedUntil" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiteSearchLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "query" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
