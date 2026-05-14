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

export default crons;
