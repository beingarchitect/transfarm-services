export interface MemberSummary {
  profileId: string;
  role: string;
  addedAt?: string;
}

/**
 * Who takes over a farm when its owner deletes their account: the longest-
 * standing co-owner who has actually signed up. Managers and guests never
 * inherit a farm, so with no such co-owner there's no successor and the farm is
 * deleted with the account.
 */
export function chooseSuccessor(members: MemberSummary[], ownerId: string): string | undefined {
  return members
    .filter((m) => m.role === "coowner" && m.profileId !== ownerId && !m.profileId.startsWith("pending_"))
    .sort((a, b) => (a.addedAt ?? "").localeCompare(b.addedAt ?? ""))[0]?.profileId;
}
