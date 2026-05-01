import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "purge expired messages",
  { minutes: 5 },
  internal.messages.deleteOldMessages
);

export default crons;
