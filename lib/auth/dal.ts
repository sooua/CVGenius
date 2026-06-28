import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, type User } from "@/db/schema/users";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Verifies the Supabase session via a contact with Auth (getUser).
 * Redirects to /login if no valid session.
 * Memoized per render pass via React cache so repeat calls are free.
 */
export const verifySession = cache(async () => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { userId: user.id, email: user.email! };
});

/**
 * Returns the current app user row, creating it on first login.
 * Caller must have already passed verifySession — we trust the id here.
 */
export const getCurrentUser = cache(async (): Promise<User> => {
  const { userId, email } = await verifySession();

  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (existing) {
    // Keep our row in sync after a confirmed Supabase email change.
    if (existing.email !== email) {
      const [updated] = await db
        .update(users)
        .set({ email, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      return updated ?? existing;
    }
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({ id: userId, email })
    .returning();
  return created;
});
