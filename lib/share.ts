import "server-only";

import { createHash } from "node:crypto";

/**
 * Helpers shared between the public share viewer (page) and the PDF route.
 * Passcodes are never stored or compared in plaintext — only this sha256 hex.
 */
export function hashPasscode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

/** Cookie that proves a viewer cleared the passcode gate for one share token. */
export function shareCookieName(token: string): string {
  return `share_${token}`;
}

/** A share is live only when enabled and (if dated) not yet past its expiry. */
export function isShareLive(share: {
  shareEnabled: boolean;
  shareExpiresAt: Date | null;
}): boolean {
  if (!share.shareEnabled) return false;
  if (share.shareExpiresAt && share.shareExpiresAt.getTime() < Date.now()) {
    return false;
  }
  return true;
}
