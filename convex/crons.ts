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

export default crons;
