-- Store AI task cost in 厘 (milli-yuan, 1/1000 元) instead of 分 (1/100 元).
-- A single small task costs a fraction of a 分 and rounded to 0 in the old
-- integer column, so recorded spend was systematically under-counted. 厘 keeps
-- small-task spend countable while staying an integer.
-- `pnpm db:push` will compute this diff automatically; SQL provided for ref.

ALTER TABLE "ai_tasks" RENAME COLUMN "cost_cny_cents" TO "cost_cny_milli";

-- Existing values were 分; convert to 厘 (×10) so historical rows stay meaningful.
UPDATE "ai_tasks" SET "cost_cny_milli" = "cost_cny_milli" * 10
WHERE "cost_cny_milli" IS NOT NULL;
