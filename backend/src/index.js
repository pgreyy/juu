// Starts the data API and the keeper. KEEPER_DRY_RUN=1 serves the API and scans events without sending
// transactions.
import { api } from "./api.js";
import { PORT, env } from "./config.js";
import { startKeeper, warn } from "./jobs.js";

// An RPC hiccup must never stop the keeper: log it as a warning and carry on.
process.on("unhandledRejection", (e) => warn("process", "error", `unhandled: ${(e?.shortMessage || e?.message || String(e)).slice(0, 200)}`));
process.on("uncaughtException", (e) => warn("process", "error", `uncaught: ${(e?.shortMessage || e?.message || String(e)).slice(0, 200)}`));

const dryRun = env("KEEPER_DRY_RUN", "0") === "1";
api().listen(PORT, "127.0.0.1", () => console.log(`Juu API on http://127.0.0.1:${PORT} (keeper ${dryRun ? "dry run" : "live"})`));
startKeeper({ dryRun });
