import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "purge expired messages",
  { minutes: 5 },
  internal.messages.deleteOldMessages,
  {}
);

crons.interval(
  "purge expired tribes",
  { hours: 1 },
  internal.tribes.deleteOldTribes,
  {}
);

crons.interval(
  "purge stale typing rows",
  { minutes: 2 },
  internal.typing.purgeStale,
  {}
);

crons.interval(
  "purge stale rate-limit rows",
  { minutes: 10 },
  internal.lib.rateLimit.purgeStale,
  {}
);

crons.interval(
  "stop stale transit fires",
  { minutes: 2 },
  internal.tribes.stopStaleTransitFires,
  {}
);

export default crons;
