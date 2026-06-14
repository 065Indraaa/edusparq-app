import { OrganizationMember } from "@/lib/db/models/OrganizationMember";

/**
 * Generates a 6-character uppercase alphanumeric join code,
 * avoiding visually ambiguous characters: 0, O, I, 1, L.
 */
export function generateJoinCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

interface OrgMemberDoc {
  _id: unknown;
  orgId: unknown;
  userId: unknown;
  nama: string;
  role: string;
  sectionId?: unknown;
  status: string;
  joinedAt: Date;
}

/**
 * Returns the OrganizationMember doc for the given orgId + userId, or null.
 * Callers can use this to gate access to org-scoped routes.
 */
export async function requireMembership(
  orgId: string,
  userId: string
): Promise<OrgMemberDoc | null> {
  const member = (await OrganizationMember.findOne({
    orgId,
    userId,
    status: "active",
  }).lean()) as OrgMemberDoc | null;
  return member;
}
