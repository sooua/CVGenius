export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function normalizeStatus(v: unknown): ApplicationStatus {
  return APPLICATION_STATUSES.includes(v as ApplicationStatus)
    ? (v as ApplicationStatus)
    : "saved";
}
