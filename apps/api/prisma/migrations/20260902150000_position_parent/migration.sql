ALTER TABLE "positions" ADD COLUMN "parentPositionId" UUID;

CREATE INDEX "positions_parentPositionId_idx" ON "positions"("parentPositionId");

ALTER TABLE "positions" ADD CONSTRAINT "positions_parentPositionId_fkey" FOREIGN KEY ("parentPositionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "positions" ADD CONSTRAINT "positions_parent_not_self" CHECK ("parentPositionId" IS NULL OR "parentPositionId" <> "id");
