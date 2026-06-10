import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";

const crons = cronJobs();

crons.interval(
  "expire inactive terminal sessions",
  { seconds: 10 },
  internal.terminalSessions.expireInactive
);

crons.interval(
  "delete expired vanished message placeholders",
  { minutes: 10 },
  internal.messages.deleteExpiredRedacted
);

export default crons;
