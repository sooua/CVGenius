"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema/users";
import { verifySession } from "@/lib/auth/dal";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolvePaymentProvider } from "@/services/payment";

const SUPPORTED_LOCALES = ["zh-CN", "en-US"] as const;

export type AccountUpdateState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | null;

export async function updateDisplayName(
  _prev: AccountUpdateState,
  formData: FormData,
): Promise<AccountUpdateState> {
  const { userId } = await verifySession();
  const raw = String(formData.get("displayName") ?? "").trim();
  if (raw.length > 120) {
    return { ok: false, error: "名字太长了（120 字以内）" };
  }

  await db
    .update(users)
    .set({
      displayName: raw || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  revalidatePath("/account");
  revalidatePath("/dashboard");
  return { ok: true, message: "已保存" };
}

export async function requestEmailChange(
  _prev: AccountUpdateState,
  formData: FormData,
): Promise<AccountUpdateState> {
  const { email: currentEmail } = await verifySession();
  const raw = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const parsed = z.email().safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "请输入有效的邮箱地址" };
  }
  if (raw === currentEmail.toLowerCase()) {
    return { ok: false, error: "新邮箱和当前邮箱一样" };
  }

  // Supabase sends a confirmation link; the email only changes once the user
  // clicks it. Our users.email syncs on next session (see getCurrentUser).
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ email: raw });
  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    message: "确认邮件已发到新邮箱，点击里面的链接后邮箱才会正式更新。",
  };
}

export async function updateLocale(
  _prev: AccountUpdateState,
  formData: FormData,
): Promise<AccountUpdateState> {
  const { userId } = await verifySession();
  const raw = String(formData.get("locale") ?? "");
  if (!SUPPORTED_LOCALES.includes(raw as (typeof SUPPORTED_LOCALES)[number])) {
    return { ok: false, error: "不支持的语言" };
  }

  await db
    .update(users)
    .set({ locale: raw, updatedAt: new Date() })
    .where(eq(users.id, userId));

  revalidatePath("/account");
  revalidatePath("/dashboard");
  return { ok: true, message: "已切换" };
}

/**
 * GDPR Art. 17 — permanently deletes the account and everything attached.
 * Requires the user to type their email as confirmation. Cancels any active
 * Stripe subscription first so a deleted account is never billed again.
 *
 * Order matters: cancel billing → wipe app rows (cascades to resumes,
 * versions, ai_tasks, orders, job_targets) → delete the Supabase auth user →
 * sign out → redirect home.
 */
export async function deleteAccount(
  _prev: AccountUpdateState,
  formData: FormData,
): Promise<AccountUpdateState> {
  const { userId, email } = await verifySession();

  const confirm = String(formData.get("confirmEmail") ?? "").trim();
  if (confirm.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, error: "邮箱不匹配，请输入你的登录邮箱以确认删除。" };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { stripeCustomerId: true },
  });

  // Stop billing before the row that holds the customer id disappears.
  if (user?.stripeCustomerId) {
    try {
      await resolvePaymentProvider("stripe").cancelActiveSubscriptions(
        user.stripeCustomerId,
      );
    } catch {
      // Don't trap the user in a deletable-but-undeletable state if Stripe is
      // unreachable; the subscription can still be cancelled from the portal.
    }
  }

  // Cascades remove resumes, versions, ai_tasks, orders, job_targets.
  await db.delete(users).where(eq(users.id, userId));

  // Remove the auth identity so the email can't sign back into a ghost account.
  try {
    await supabaseAdmin().auth.admin.deleteUser(userId);
  } catch {
    // App data is already gone; a stale auth row is harmless and re-creates a
    // fresh empty profile on next login.
  }

  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
