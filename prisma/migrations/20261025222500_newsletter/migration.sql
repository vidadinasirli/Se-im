-- Adds explicit-consent newsletter subscriptions and moderated weekly delivery.
CREATE TABLE IF NOT EXISTS "NewsletterSubscriber" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'CONFIRMED')),
  "confirmationTokenHash" TEXT UNIQUE,
  "unsubscribeToken" TEXT NOT NULL UNIQUE,
  "consentAt" DATETIME NOT NULL,
  "confirmedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "NewsletterSubscriber_status_createdAt_idx"
ON "NewsletterSubscriber"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "NewsletterDraft" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "weekKey" TEXT NOT NULL UNIQUE,
  "subject" TEXT NOT NULL,
  "preview" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "sources" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK ("status" IN ('PENDING_REVIEW', 'APPROVED', 'SENT', 'REJECTED')),
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" DATETIME
);

CREATE INDEX IF NOT EXISTS "NewsletterDraft_status_createdAt_idx"
ON "NewsletterDraft"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "NewsletterDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "draftId" TEXT NOT NULL,
  "subscriberId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SENDING'
    CHECK ("status" IN ('SENDING', 'SENT', 'FAILED')),
  "providerMessageId" TEXT,
  "error" TEXT,
  "sentAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "NewsletterDelivery_draftId_fkey"
    FOREIGN KEY ("draftId") REFERENCES "NewsletterDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NewsletterDelivery_subscriberId_fkey"
    FOREIGN KEY ("subscriberId") REFERENCES "NewsletterSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NewsletterDelivery_draftId_subscriberId_key"
    UNIQUE ("draftId", "subscriberId")
);

CREATE INDEX IF NOT EXISTS "NewsletterDelivery_draftId_status_idx"
ON "NewsletterDelivery"("draftId", "status");
