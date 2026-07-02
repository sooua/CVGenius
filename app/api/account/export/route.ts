import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { aiTasks } from "@/db/schema/aiTasks";
import { jobTargets } from "@/db/schema/jobTargets";
import { orders } from "@/db/schema/orders";
import { resumes, resumeVersions } from "@/db/schema/resumes";
import { users } from "@/db/schema/users";
import { verifySession } from "@/lib/auth/dal";

// Drizzle queries run on Node runtime.
export const runtime = "nodejs";

/**
 * GDPR Art. 15 — lets a user download everything we hold on them as one
 * JSON file. Owner-scoped: every row is filtered by the session userId.
 */
export async function GET() {
  const { userId } = await verifySession();

  const [user, userResumes, userJobTargets, userAiTasks, userOrders] =
    await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, userId) }),
      db.query.resumes.findMany({
        where: eq(resumes.userId, userId),
        orderBy: [desc(resumes.createdAt)],
      }),
      db.query.jobTargets.findMany({ where: eq(jobTargets.userId, userId) }),
      db.query.aiTasks.findMany({
        where: eq(aiTasks.userId, userId),
        orderBy: [desc(aiTasks.createdAt)],
      }),
      db.query.orders.findMany({
        where: eq(orders.userId, userId),
        orderBy: [desc(orders.createdAt)],
      }),
    ]);

  const resumeIds = userResumes.map((r) => r.id);
  const versions = resumeIds.length
    ? await db.query.resumeVersions.findMany({
        where: inArray(resumeVersions.resumeId, resumeIds),
        orderBy: [desc(resumeVersions.createdAt)],
      })
    : [];

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    account: user
      ? {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          locale: user.locale,
          plan: user.plan,
          createdAt: user.createdAt,
        }
      : null,
    resumes: userResumes,
    resumeVersions: versions,
    jobTargets: userJobTargets,
    aiTasks: userAiTasks,
    orders: userOrders,
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = `cvgenius-data-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
