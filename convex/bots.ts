import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const BOT_LEADER = {
  id: "bot_tribe_leader",
  name: "tribe-leader",
  avatarSeed: "bot-leader-fixed-seed",
};

export const BOT_BOUNCER = {
  id: "bot_tribe_bouncer",
  name: "tribe-bouncer",
  avatarSeed: "bot-bouncer-fixed-seed",
};

// ─── Swear detection ──────────────────────────────────────────────────────────

const SWEAR_WORDS = new Set([
  // English
  "fuck", "fucking", "fucker", "fucked", "motherfucker", "motherfucking",
  "shit", "shitting", "bullshit",
  "ass", "asshole", "asses",
  "bitch", "bitches",
  "cunt",
  "dick",
  "cock",
  "piss",
  "bastard",
  "whore",
  "slut",
  "fag", "faggot",
  "retard", "retarded",
  "nigger", "nigga",
  // Swedish
  "fan", "jävlar", "helvete", "jävla", "skit", "satan", "fitta", "kuk", "röv", "fasiken", "jäklar",
]);

function containsSwearing(text: string): boolean {
  // \p{L} preserves Unicode letters (Swedish ä/ö/å etc.) while stripping punctuation
  const normalized = text.toLowerCase().replace(/[^\p{L}\d\s]/gu, " ");
  return normalized.split(/\s+/).some((w) => SWEAR_WORDS.has(w));
}

// ─── Moderation ───────────────────────────────────────────────────────────────

export const moderateMessage = internalMutation({
  args: {
    tribeId: v.id("tribes"),
    authorId: v.string(),
    authorName: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { tribeId, authorId, authorName, text }) => {
    const member = await ctx.db
      .query("tribeMembers")
      .withIndex("by_tribeId_and_userId", (q) =>
        q.eq("tribeId", tribeId).eq("userId", authorId)
      )
      .first();
    if (!member || member.banned) return;

    // Already serving a temp kick — skip until it expires
    if (member.kickedUntil && member.kickedUntil > Date.now()) return;

    const hasSwear = containsSwearing(text);

    // Spam: 5+ top-level messages from this user in the last 10 seconds
    const spamWindow = Date.now() - 10_000;
    const recentMsgs = await ctx.db
      .query("messages")
      .withIndex("by_tribeId_and_timestamp", (q) =>
        q.eq("tribeId", tribeId).gt("timestamp", spamWindow)
      )
      .take(100);
    const isSpam =
      recentMsgs.filter((m) => m.authorId === authorId && !m.parentId).length >= 5;

    if (!hasSwear && !isSpam) return;

    const warnCount = member.warnCount ?? 0;
    const kickCount = member.kickCount ?? 0;

    // Progressive: warn → mute → kick → ban
    let action: "warn" | "mute" | "kick" | "ban";
    if (member.kicked) {
      action = "ban"; // already been kicked — permanent ban
    } else if (kickCount >= 1) {
      action = "kick"; // already been muted once — actual kick from tribe
    } else if (isSpam || warnCount >= 2) {
      action = "mute"; // temp silence for 5 min
    } else {
      action = "warn";
    }

    const now = Date.now();

    if (action === "warn") {
      await ctx.db.patch(member._id, { warnCount: warnCount + 1 });
      const strikesLeft = 2 - (warnCount + 1);
      await ctx.db.insert("messages", {
        tribeId,
        text:
          `⚠️ @${authorName} — ${hasSwear ? "keep it clean around the fire" : "slow down"}. ` +
          (strikesLeft > 0
            ? `${strikesLeft} strike${strikesLeft > 1 ? "s" : ""} left before you're muted.`
            : `Next violation and you're muted.`),
        author: BOT_BOUNCER.name,
        authorId: BOT_BOUNCER.id,
        timestamp: now,
        avatarSeed: BOT_BOUNCER.avatarSeed,
        likes: [],
      });
      await ctx.db.insert("messages", {
        tribeId,
        text: `💛 @tribe-leader here — treat others the way you'd want to be treated yourself. This fire burns brighter when everyone feels welcome.`,
        author: BOT_LEADER.name,
        authorId: BOT_LEADER.id,
        timestamp: now + 1,
        avatarSeed: BOT_LEADER.avatarSeed,
        likes: [],
      });
    } else if (action === "mute") {
      const kickedUntil = now + 5 * 60 * 1000;
      await ctx.db.patch(member._id, { kickCount: kickCount + 1, kickedUntil });
      // Delete the offending recent messages (last 30 seconds)
      await Promise.all(
        recentMsgs
          .filter((m) => m.authorId === authorId && now - m.timestamp <= 30_000)
          .map(async (m) => {
            if (m.storageId) await ctx.storage.delete(m.storageId);
            await ctx.db.delete(m._id);
          })
      );
      await ctx.db.insert("messages", {
        tribeId,
        text: `🔇 @${authorName} muted for 5 minutes for ${isSpam ? "spamming" : "repeated violations"}. Come back when you've cooled off.`,
        author: BOT_BOUNCER.name,
        authorId: BOT_BOUNCER.id,
        timestamp: now,
        avatarSeed: BOT_BOUNCER.avatarSeed,
        likes: [],
      });
    } else if (action === "kick") {
      await ctx.db.patch(member._id, { kicked: true });
      // Erase their recent messages (last 5 min)
      await Promise.all(
        recentMsgs
          .filter((m) => m.authorId === authorId)
          .map(async (m) => {
            if (m.storageId) await ctx.storage.delete(m.storageId);
            await ctx.db.delete(m._id);
          })
      );
      await ctx.db.insert("messages", {
        tribeId,
        text: `🚫 @${authorName} has been kicked from the campfire for repeated violations. The fire is better without them.`,
        author: BOT_BOUNCER.name,
        authorId: BOT_BOUNCER.id,
        timestamp: now,
        avatarSeed: BOT_BOUNCER.avatarSeed,
        likes: [],
      });
    } else {
      // ban — schedule batched deletion to avoid tx-budget blowup on large tribes
      await ctx.db.patch(member._id, { banned: true });
      await ctx.scheduler.runAfter(0, internal.messages.deleteByAuthor, { tribeId, authorId });
      await ctx.db.insert("messages", {
        tribeId,
        text: `🔨 @${authorName} has been permanently banned from this campfire. The tribe has spoken.`,
        author: BOT_BOUNCER.name,
        authorId: BOT_BOUNCER.id,
        timestamp: now,
        avatarSeed: BOT_BOUNCER.avatarSeed,
        likes: [],
      });
    }

    await ctx.db.patch(tribeId, { lastMessageAt: now });
  },
});

// ─── New tribe greeting ───────────────────────────────────────────────────────

export const greetTribe = internalMutation({
  args: {
    tribeId: v.id("tribes"),
    tribeName: v.string(),
  },
  handler: async (ctx, { tribeId, tribeName }) => {
    const tribe = await ctx.db.get(tribeId);
    if (!tribe) return;
    await ctx.db.insert("messages", {
      tribeId,
      text: `🔥 The fire is lit! Welcome to **${tribeName}**. I'm @tribe-leader — your campfire host. @tribe-bouncer is also here keeping the vibes in check. Gather round!`,
      author: BOT_LEADER.name,
      authorId: BOT_LEADER.id,
      timestamp: Date.now(),
      avatarSeed: BOT_LEADER.avatarSeed,
      likes: [],
    });
    await ctx.db.patch(tribeId, { lastMessageAt: Date.now() });
  },
});

// ─── New user welcome ─────────────────────────────────────────────────────────

export const welcomeUser = internalMutation({
  args: {
    tribeId: v.id("tribes"),
    userName: v.string(),
    tribeName: v.string(),
  },
  handler: async (ctx, { tribeId, userName, tribeName }) => {
    const tribe = await ctx.db.get(tribeId);
    if (!tribe) return;
    await ctx.db.insert("messages", {
      tribeId,
      text: `Welcome to the fire, @${userName}! 🔥 You're now part of **${tribeName}**. Keep it warm out there.`,
      author: BOT_LEADER.name,
      authorId: BOT_LEADER.id,
      timestamp: Date.now(),
      avatarSeed: BOT_LEADER.avatarSeed,
      likes: [],
    });
    await ctx.db.patch(tribeId, { lastMessageAt: Date.now() });
  },
});
