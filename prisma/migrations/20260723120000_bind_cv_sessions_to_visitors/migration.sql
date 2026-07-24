ALTER TABLE "CVSession" ADD COLUMN "visitorId" TEXT;

CREATE INDEX "CVSession_visitorId_idx" ON "CVSession"("visitorId");
