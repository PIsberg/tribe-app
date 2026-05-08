import { query } from "./_generated/server";

const THIRTY_MIN = 30 * 60 * 1000;
const TWENTYFOUR_H = 24 * 60 * 60 * 1000;
const TYPING_WINDOW = 4_000;
const HARD_CAP = 10_000;
const RECENT_MSG_CAP = 5_000;

export const getNetworkStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const activeTribes = await ctx.db
      .query("tribes")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", now - TWENTYFOUR_H))
      .collect();

    const allTribesSample = await ctx.db.query("tribes").take(HARD_CAP);

    const recentMessages = await ctx.db
      .query("messages")
      .withIndex("by_timestamp", (q) => q.gt("timestamp", now - THIRTY_MIN))
      .take(RECENT_MSG_CAP);

    // typing table is tiny (4s TTL purge) — full scan is acceptable
    const allTyping = await ctx.db.query("typing").collect();
    const livePresence = allTyping.filter((p) => p.updatedAt > now - TYPING_WINDOW);

    const hottest = [...activeTribes]
      .sort((a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt))
      .slice(0, 5);

    const memberCounts = await Promise.all(
      hottest.map((t) =>
        ctx.db
          .query("tribeMembers")
          .withIndex("by_tribeId", (q) => q.eq("tribeId", t._id))
          .take(500)
          .then((m) => m.filter((x) => !x.kicked && !x.banned).length)
      )
    );

    const liveUserIds = new Set(livePresence.map((p) => p.userId));
    const recentAuthorIds = new Set(recentMessages.map((m) => m.authorId));
    const reactionsRecent = recentMessages.reduce((n, m) => n + (m.likes?.length ?? 0), 0);
    const threadsActive = recentMessages.filter(
      (m) => (m.replyCount ?? 0) > 0 || m.parentId != null
    ).length;

    // 6 buckets of 10 min each over the past hour (oldest → newest)
    const buckets = new Array(6).fill(0);
    const sparkStart = now - 60 * 60 * 1000;
    for (const m of recentMessages) {
      if (m.timestamp >= sparkStart) {
        const idx = Math.min(5, Math.floor((m.timestamp - sparkStart) / (10 * 60 * 1000)));
        buckets[idx]++;
      }
    }

    return {
      generatedAt: now,
      activeTribes: activeTribes.length,
      totalTribes: allTribesSample.length,
      totalTribesCapped: allTribesSample.length === HARD_CAP,
      messagesLast30Min: recentMessages.length,
      messagesLast30MinCapped: recentMessages.length === RECENT_MSG_CAP,
      liveUsers: liveUserIds.size,
      activeSpeakersLast30Min: recentAuthorIds.size,
      reactionsLast30Min: reactionsRecent,
      threadsActive,
      hottest: hottest.map((t, i) => ({
        _id: t._id as string,
        name: t.name,
        lastActivity: t.lastMessageAt ?? t.createdAt,
        memberCount: memberCounts[i],
      })),
      sparkline: buckets,
    };
  },
});
