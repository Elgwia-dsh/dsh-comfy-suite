/**
 * Queue tracking: remembers every prompt this plugin queued (from tools or
 * the panel) so the panel can show "ours" in the ComfyUI queue and move
 * completed runs into the asset index. Sweeps run on read (queue/assets
 * routes), so no background timers leak into the fiber lifecycle.
 */
import { collectMedia, hasMedia } from './comfyui.js';
/** Upper bound on remembered runs; oldest are dropped beyond this. */
const MAX_TRACKED_RUNS = 500;
/** How many consecutive sweeps may miss a prompt's history before it is dropped. */
const MAX_MISSES = 10;
/** How many history reads to keep in flight during one sweep. */
const SWEEP_CONCURRENCY = 4;
/** Tracks queued prompts until they complete or vanish. */
export class QueueTracker {
    persisted;
    runs = new Map();
    /** Prompt ids already swept into the asset index, so sweep is idempotent. */
    archived = new Set();
    /** promptId → consecutive sweeps that found no history entry yet. */
    misses = new Map();
    /** In-flight sweep, shared by concurrent callers. */
    sweeping = null;
    /**
     * Optional durable backing: the tracked memory is persisted so completed
     * runs still land in the asset index after a web-server restart.
     */
    constructor(persisted) {
        this.persisted = persisted;
    }
    /** Restore persisted runs/archived state; call once before tracking. */
    async init() {
        if (this.persisted === undefined)
            return;
        const state = await this.persisted.load();
        for (const run of state.runs) {
            this.runs.set(run.promptId, {
                // Keep any extra fields a newer version persisted (e.g. `settled`).
                ...run,
                promptId: run.promptId,
                ts: run.ts,
                workflowName: run.workflowName,
                source: run.source,
            });
        }
        for (const id of state.archived)
            this.archived.add(id);
        // Archived ids no longer have a run to protect; drop them so the set
        // does not grow for the life of the installation.
        for (const id of this.archived) {
            if (!this.runs.has(id))
                this.archived.delete(id);
        }
    }
    /** Fire-and-forget persistence; failures must not break queueing. */
    persistNow() {
        if (this.persisted === undefined)
            return;
        const state = {
            runs: [...this.runs.values()],
            archived: [...this.archived],
        };
        void this.persisted.save(state).catch(() => undefined);
    }
    track(run) {
        this.runs.delete(run.promptId);
        this.runs.set(run.promptId, run);
        this.misses.delete(run.promptId);
        this.persistNow();
    }
    untrack(promptId) {
        const had = this.runs.delete(promptId);
        this.misses.delete(promptId);
        if (had)
            this.persistNow();
    }
    get(promptId) {
        return this.runs.get(promptId);
    }
    list() {
        return [...this.runs.values()];
    }
    /**
     * Move completed tracked runs into the asset store, and forget runs whose
     * prompt no longer exists.
     *
     * History reads run a few at a time instead of one after another (a backlog
     * of tracked runs used to mean one upstream round-trip each, serially, on
     * every assets-page load), and a run is dropped after MAX_MISSES empty
     * answers instead of being re-read forever — a cancelled prompt never
     * produces a history entry, so it used to be re-fetched on every sweep.
     * @returns the records newly appended.
     */
    async sweep(opts) {
        if (this.sweeping !== null)
            return this.sweeping;
        this.sweeping = this.runSweep(opts).finally(() => {
            this.sweeping = null;
        });
        return this.sweeping;
    }
    async runSweep(opts) {
        const candidates = [...this.runs.values()].filter((run) => !this.archived.has(run.promptId) && run.settled !== true);
        const completed = [];
        if (candidates.length > 0) {
            const answers = await mapLimit(candidates, SWEEP_CONCURRENCY, async (run) => {
                try {
                    return { run, entry: await opts.client.getHistory(run.promptId) };
                }
                catch {
                    // A transient failure is not "gone": count it like a miss.
                    return { run, entry: undefined };
                }
            });
            let changed = false;
            for (const { run, entry } of answers) {
                if (entry === undefined) {
                    const misses = (this.misses.get(run.promptId) ?? 0) + 1;
                    this.misses.set(run.promptId, misses);
                    if (misses >= MAX_MISSES) {
                        this.runs.delete(run.promptId);
                        this.misses.delete(run.promptId);
                        changed = true;
                    }
                    continue;
                }
                this.misses.delete(run.promptId);
                if (isCompleted(entry)) {
                    const media = collectMedia({
                        promptId: run.promptId,
                        entry,
                        maxItems: opts.maxItems,
                        proxyBase: opts.proxyBase,
                    });
                    const record = {
                        promptId: run.promptId,
                        ts: run.ts,
                        workflowName: run.workflowName,
                        source: run.source,
                        media,
                    };
                    await opts.store.appendAsset(record);
                    completed.push(record);
                    this.archived.add(run.promptId);
                    // The run is archived: keeping it only makes every later
                    // sweep skip it and every queue listing show a ghost row.
                    this.runs.delete(run.promptId);
                    changed = true;
                    continue;
                }
                if (isTerminalFailure(entry)) {
                    // Failed/interrupted: no media to archive, but keep the run so
                    // the panel can still name the job — just stop re-reading it.
                    run.settled = true;
                    changed = true;
                }
            }
            while (this.runs.size > MAX_TRACKED_RUNS) {
                const oldest = this.runs.keys().next().value;
                if (oldest === undefined)
                    break;
                this.runs.delete(oldest);
                this.misses.delete(oldest);
                changed = true;
            }
            if (changed)
                this.persistNow();
        }
        return completed;
    }
}
function isCompleted(entry) {
    return entry.status?.status_str === 'success'
        || entry.status?.completed === true
        || hasMedia(entry);
}
/** Failed or interrupted: terminal, but nothing to archive. */
function isTerminalFailure(entry) {
    const status = entry.status?.status_str;
    return status === 'error' || status === 'interrupted';
}
/** Run `worker` over `items` with at most `limit` in flight, preserving order. */
async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let next = 0;
    const runners = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
        for (;;) {
            const index = next;
            next += 1;
            if (index >= items.length)
                return;
            results[index] = await worker(items[index]);
        }
    });
    await Promise.all(runners);
    return results;
}