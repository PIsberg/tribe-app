import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { readTribeMemberCount } from "../metrics";

// Maximum active members per fire. Above this, push fan-out cost makes the
// chat UX feel laggy (see PR5_CURVE_AND_FINDINGS.md: ~340ms p50 at 200 subs).
// Reject new joins past this point; existing members can keep chatting.
export const FIRE_CAPACITY = 200;

/**
 * Throws ConvexError("FIRE_FULL") if the tribe is at or above capacity AND
 * the caller is not already a member. Existing members are always allowed
 * back in (rejoin, name change) regardless of count.
 */
export async function assertFireHasCapacity(
  ctx: MutationCtx,
  tribeId: Id<"tribes">,
  callerIsExistingMember: boolean
): Promise<void> {
  if (callerIsExistingMember) return;
  const count = await readTribeMemberCount(ctx, tribeId);
  if (count >= FIRE_CAPACITY) throw new ConvexError("FIRE_FULL");
}
