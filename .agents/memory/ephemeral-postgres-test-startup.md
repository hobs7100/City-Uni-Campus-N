---
name: Ephemeral PostgreSQL test startup
description: Replit-specific local PostgreSQL startup behavior for isolated integration tests.
---

## Running multiple isolated suites

Prefer serial workers for full integration runs that start several temporary PostgreSQL clusters.

**Why:** Concurrent cluster startups exceeded the default hook timeout in this workspace even though the individual suite passed. Running the full suite with one worker passed without application changes.

**How to apply:** Run the PostgreSQL integration suites with `--maxWorkers=1` before treating a full-suite startup timeout as an application regression.

## Starting a cluster

For a temporary PostgreSQL server in this environment, explicitly select a writable Unix-socket directory. When launching `pg_ctl` with a synchronous child-process call, redirect the server log to a file.

**Why:** The default socket directory `/run/postgresql` does not exist here. Without a log file, the daemon inherits the child-process output pipes and the synchronous parent waits indefinitely for EOF even though the server has started.

**How to apply:** Use the temporary cluster directory for sockets and pass a log-file path to `pg_ctl start`; stop the server and remove the temporary directory in test teardown. Keep the test pool explicitly pointed at this instance, never the app's configured database.