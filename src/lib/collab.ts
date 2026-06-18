import { Types } from "mongoose";
import { CollabGroup } from "../lib/db/models/Collab";
import { isPusherConfigured, getPusherServer } from "../lib/pusher";

/** Stable Pusher channel name for a group. */
export function groupChannel(groupId: string): string {
  return `collab-group-${groupId}`;
}

/**
 * Generate a short, unambiguous join code (no easily-confused chars).
 * Uniqueness is verified against the DB by the caller.
 */
export function generateJoinCode(seed: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1
  let n = Math.abs(Math.floor(seed)) || 1;
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length) + (i + 1) * 7;
  }
  return code;
}

/**
 * Returns the group if the user is a member, otherwise null.
 * Centralizes the membership authorization check used by every collab route.
 */
export async function getMemberGroup(groupId: string, userId: string) {
  if (!Types.ObjectId.isValid(groupId)) return null;
  const group = await CollabGroup.findById(groupId);
  if (!group) return null;
  const isMember = group.members.some(
    (m: { userId: Types.ObjectId }) => String(m.userId) === String(userId)
  );
  return isMember ? group : null;
}

/**
 * Fire-and-forget realtime broadcast to a group's channel. No-op (and never
 * throws) when Pusher is not configured, so persistence still works locally.
 */
export async function broadcastToGroup(
  groupId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!isPusherConfigured()) return;
  try {
    await getPusherServer().trigger(groupChannel(groupId), event, payload);
  } catch (err) {
    console.error("[collab] broadcast failed:", err);
  }
}
