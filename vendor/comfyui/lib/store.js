/**
 * Durable plugin data: the saved-workflow library and the generated-asset
 * index, both persisted as JSON files under the plugin data directory
 * (`dataDir`, default DSH_HOME/data/dsh-comfyui). ComfyUI's own history is
 * ephemeral, so the asset index is the plugin's memory of what it generated.
 *
 * Two properties matter more than anything else here, because this is the only
 * place user data can be lost:
 *
 *   1. **No torn writes.** Every file is written to a sibling temp file and
 *      renamed over the target, so a crash mid-write leaves the previous
 *      version intact instead of a truncated JSON document.
 *   2. **No lost updates.** Every read-modify-write runs through one serial
 *      queue per file. The panel saving a workflow while the agent refreshes
 *      its parameters used to be a real interleaving: both read the list, both
 *      wrote it back, one of the two edits vanished.
 *
 * A file that fails to parse is quarantined (`<name>.corrupt-<ts>`) instead of
 * being treated as "absent": absence is followed by a write that would replace
 * the whole library with an empty list.
 */
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
/** Trailing newline for the JSON files this store writes. */
const NEWLINE = '\n';
/** Upper bound for the auxiliary name→value maps (sizes / hashes). */
const MAX_AUX_ENTRIES = 6_000;
/** Validate a workflow-shaped value; returns an error message or undefined. */
export function validateWorkflow(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return 'workflow must be an object mapping node id → { class_type, inputs }';
    }
    const entries = Object.entries(value);
    if (entries.length === 0)
        return 'workflow must contain at least one node';
    for (const [id, node] of entries) {
        if (typeof node !== 'object' || node === null)
            return `node "${id}" must be an object`;
        const record = node;
        if (typeof record.class_type !== 'string' || record.class_type === '') {
            return `node "${id}" needs a non-empty class_type`;
        }
        if (typeof record.inputs !== 'object' || record.inputs === null) {
            return `node "${id}" needs an inputs object`;
        }
    }
    return undefined;
}
function sanitizeText(value, max) {
    return typeof value === 'string' ? value.slice(0, max) : '';
}
/**
 * One serial queue per file path: concurrent read-modify-write cycles on the
 * same document run one after another instead of racing.
 */
const fileQueues = new Map();
function serialized(path, work) {
    const previous = fileQueues.get(path) ?? Promise.resolve();
    const run = previous.then(work, work);
    // The stored tail must never reject, or every later writer inherits it.
    fileQueues.set(path, run.then(() => undefined, () => undefined));
    return run;
}
let tempCounter = 0;
/**
 * Replace one JSON file atomically: write a sibling temp file, then rename it
 * over the target. `rename` is atomic on both NTFS and POSIX, so readers see
 * either the old or the new document, never a half-written one.
 */
async function writeJsonAtomic(path, value, pretty) {
    const text = pretty === false
        ? `${JSON.stringify(value)}${NEWLINE}`
        : `${JSON.stringify(value, null, 2)}${NEWLINE}`;
    const temp = `${path}.tmp-${process.pid}-${++tempCounter}`;
    await writeFile(temp, text, 'utf8');
    // Windows briefly refuses to replace a file another process has open (an
    // indexer, an editor, a sync client): one short retry turns that transient
    // EPERM/EBUSY into a successful save instead of a failed one.
    for (let attempt = 0; ; attempt += 1) {
        try {
            await rename(temp, path);
            return;
        }
        catch (error) {
            const transient = error?.code === 'EPERM' || error?.code === 'EBUSY' || error?.code === 'EACCES';
            if (!transient || attempt >= 2) {
                await unlink(temp).catch(() => undefined);
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 60));
        }
    }
}
/**
 * Read + parse one JSON file.
 *
 * A parse failure is not "no file": a truncated write, a half-synced cloud
 * folder or a hand edit would otherwise silently become an empty library that
 * the next save makes permanent. The bad bytes are copied aside for recovery
 * and reported through `onCorrupt`.
 */
async function readJsonFile(path, fallback, onCorrupt) {
    let raw;
    try {
        raw = await readFile(path, 'utf8');
    }
    catch {
        return fallback;
    }
    if (raw.trim() === '')
        return fallback;
    try {
        return JSON.parse(raw);
    }
    catch (error) {
        const quarantine = `${path}.corrupt-${Date.now()}`;
        await copyFile(path, quarantine).catch(() => undefined);
        onCorrupt?.(quarantine, error instanceof Error ? error.message : String(error));
        return fallback;
    }
}
/** JSON-file-backed store for workflows and assets. */
export class ComfyUIStore {
    maxAssets;
    workflowsPath;
    assetsPath;
    trackedPath;
    mediaSizesPath;
    mediaHashesPath;
    currentImagePath;
    /** Root of the per-workflow skill packs (one directory per pack). */
    skillsRoot;
    /** Optional sink for data-integrity problems (a corrupt file, a cap). */
    log;
    /**
     * Process-local mirrors of the on-disk documents. Every mutation updates
     * the mirror inside its serialized section, so a read never has to hit the
     * disk twice and the panel's 3-second polls stop re-parsing the whole
     * library. `undefined` = not loaded yet.
     */
    workflows;
    assets;
    mediaSizes;
    mediaHashes;
    slots;
    constructor(dir, maxAssets, log) {
        this.maxAssets = maxAssets;
        this.log = log;
        this.skillsRoot = join(dir, 'skills');
        this.workflowsPath = join(dir, 'workflows.json');
        this.assetsPath = join(dir, 'assets.json');
        this.trackedPath = join(dir, 'tracked.json');
        this.mediaSizesPath = join(dir, 'media-sizes.json');
        this.mediaHashesPath = join(dir, 'media-hashes.json');
        this.currentImagePath = join(dir, 'current-image.json');
    }
    /** Ensure the data directory exists. */
    async init() {
        await mkdir(dirname(this.workflowsPath), { recursive: true });
    }
    corruptReporter(path) {
        return (quarantine, message) => {
            this.log?.(`store: ${path} could not be parsed (${message}); kept a copy at ${quarantine}`);
        };
    }
    // -----------------------------------------------------------------------
    // Load-area slots
    // -----------------------------------------------------------------------
    /** Load the slot list; the mirrored value survives between calls. */
    async loadSlots() {
        if (this.slots !== undefined)
            return this.slots;
        const parsed = await readJsonFile(this.currentImagePath, undefined, this.corruptReporter('current-image.json'));
        this.slots = parseSlots(parsed);
        return this.slots;
    }
    async saveSlots(slots) {
        this.slots = slots;
        await serialized(this.currentImagePath, () => writeJsonAtomic(this.currentImagePath, { items: slots }));
    }
    // -----------------------------------------------------------------------
    // Workflow library
    // -----------------------------------------------------------------------
    async loadWorkflows() {
        if (this.workflows !== undefined)
            return this.workflows;
        const parsed = await readJsonFile(this.workflowsPath, [], this.corruptReporter('workflows.json'));
        this.workflows = Array.isArray(parsed) ? parsed : [];
        return this.workflows;
    }
    async listWorkflows() {
        return this.loadWorkflows();
    }
    async getWorkflow(id) {
        return (await this.loadWorkflows()).find((workflow) => workflow.id === id);
    }
    /** Replace the whole library (used by import/restore paths). */
    async writeWorkflows(list) {
        this.workflows = list;
        await serialized(this.workflowsPath, () => writeJsonAtomic(this.workflowsPath, list));
    }
    /** Create or update a workflow (update when `input.id` matches an existing one). */
    async saveWorkflow(input) {
        return (await this.saveWorkflowsBatch([input]))[0];
    }
    /**
     * Create or update several workflows with **one** read and one write.
     *
     * Importing a preset used to call saveWorkflow per entry: each call read
     * and rewrote the entire library, so a 100-workflow import parsed and
     * re-serialised the whole file 100 times. Results keep the input order.
     */
    async saveWorkflowsBatch(inputs) {
        const results = [];
        await serialized(this.workflowsPath, async () => {
            const list = await this.loadWorkflows();
            for (const input of inputs) {
                const problem = validateWorkflow(input.workflow);
                if (problem !== undefined) {
                    results.push({ ok: false, error: problem });
                    continue;
                }
                const name = sanitizeText(input.name, 80) || 'unnamed-workflow';
                const description = sanitizeText(input.description, 2000);
                const workflow = input.workflow;
                const parameters = Array.isArray(input.parameters) && input.parameters.length > 0 ? input.parameters : undefined;
                const tags = Array.isArray(input.tags)
                    ? [...new Set(input.tags.map((tag) => sanitizeText(tag, 24)).filter((tag) => tag !== ''))]
                    : undefined;
                const now = new Date().toISOString();
                if (input.id !== undefined) {
                    const index = list.findIndex((entry) => entry.id === input.id);
                    if (index === -1) {
                        results.push({ ok: false, error: `workflow "${input.id}" not found` });
                        continue;
                    }
                    const updated = {
                        ...list[index], name, description, workflow,
                        parameters,
                        tags: tags !== undefined ? tags : list[index].tags,
                        // Skill-pack fields are owned by the skill routes, not the workflow
                        // editor: a plain save must never drop a pack the user attached.
                        skillDir: list[index].skillDir,
                        requireSkill: list[index].requireSkill,
                        source: input.source ?? list[index].source,
                        comfyuiFile: input.comfyuiFile ?? list[index].comfyuiFile,
                        updatedAt: now,
                    };
                    list[index] = updated;
                    results.push({ ok: true, workflow: updated });
                    continue;
                }
                const created = {
                    id: randomUUID(), name, description, workflow,
                    parameters,
                    tags: tags !== undefined && tags.length > 0 ? tags : undefined,
                    source: input.source,
                    comfyuiFile: input.comfyuiFile,
                    updatedAt: now,
                };
                list.push(created);
                results.push({ ok: true, workflow: created });
            }
            if (results.some((result) => result.ok))
                await writeJsonAtomic(this.workflowsPath, list);
        });
        return results;
    }
    /** Patch the skill-pack fields of one workflow without touching its JSON or
     * parameters. `skillDir: null` detaches the pack (the directory stays on
     * disk until an explicit destroy). */
    async updateWorkflowSkill(id, patch) {
        let updated;
        await serialized(this.workflowsPath, async () => {
            const list = await this.loadWorkflows();
            const index = list.findIndex((entry) => entry.id === id);
            if (index === -1)
                return;
            const current = list[index];
            const next = { ...current, updatedAt: new Date().toISOString() };
            if (patch.skillDir !== undefined) {
                if (patch.skillDir === null) {
                    delete next.skillDir;
                    delete next.requireSkill;
                }
                else {
                    next.skillDir = patch.skillDir;
                }
            }
            if (patch.requireSkill !== undefined) {
                if (patch.requireSkill)
                    next.requireSkill = true;
                else
                    delete next.requireSkill;
            }
            list[index] = next;
            await writeJsonAtomic(this.workflowsPath, list);
            updated = next;
        });
        return updated;
    }
    /** Delete a workflow by id; false when it did not exist. */
    async deleteWorkflow(id) {
        let removed = false;
        await serialized(this.workflowsPath, async () => {
            const list = await this.loadWorkflows();
            const next = list.filter((entry) => entry.id !== id);
            if (next.length === list.length)
                return;
            await writeJsonAtomic(this.workflowsPath, next);
            this.workflows = next;
            removed = true;
        });
        return removed;
    }
    // -----------------------------------------------------------------------
    // Asset index
    // -----------------------------------------------------------------------
    async listAssets() {
        if (this.assets !== undefined)
            return this.assets;
        const parsed = await readJsonFile(this.assetsPath, [], this.corruptReporter('assets.json'));
        this.assets = Array.isArray(parsed) ? parsed : [];
        return this.assets;
    }
    /** promptId → workflowName, for naming queue rows without a full scan. */
    async assetNameMap() {
        const map = new Map();
        for (const asset of await this.listAssets()) {
            if (typeof asset?.promptId === 'string')
                map.set(asset.promptId, asset.workflowName ?? null);
        }
        return map;
    }
    /** Drop one asset record from the index; returns the record that was
     * removed so the caller can delete the files it referenced. */
    async deleteAsset(promptId) {
        let removed;
        await serialized(this.assetsPath, async () => {
            const list = await this.listAssets();
            const index = list.findIndex((record) => record.promptId === promptId);
            if (index === -1)
                return;
            [removed] = list.splice(index, 1);
            await writeJsonAtomic(this.assetsPath, list);
        });
        return removed;
    }
    /** Prepend an asset record (deduplicated by promptId, capped at maxAssets). */
    async appendAsset(record) {
        let appended = false;
        await serialized(this.assetsPath, async () => {
            const list = await this.listAssets();
            if (list.some((entry) => entry.promptId === record.promptId))
                return;
            list.unshift(record);
            if (list.length > this.maxAssets)
                list.length = this.maxAssets;
            await writeJsonAtomic(this.assetsPath, list);
            appended = true;
        });
        return appended;
    }
    /** Load the persisted queue-tracker state (empty when absent/corrupt). */
    async loadTracked() {
        const data = await readJsonFile(this.trackedPath, {}, this.corruptReporter('tracked.json'));
        const runs = Array.isArray(data.runs) ? data.runs.filter((run) => typeof run === 'object' && run !== null && typeof run.promptId === 'string')
            : [];
        const archived = Array.isArray(data.archived) ? data.archived.filter((id) => typeof id === 'string') : [];
        return { runs, archived };
    }
    /** Persist the queue-tracker state so completed runs survive restarts. */
    async saveTracked(state) {
        await serialized(this.trackedPath, () => writeJsonAtomic(this.trackedPath, state, false));
    }
    // -----------------------------------------------------------------------
    // Auxiliary maps: uploaded pixel sizes and content hashes
    // -----------------------------------------------------------------------
    /** Pixel sizes of files uploaded through the panel, keyed by file name —
     * used to default the workflow output size to the source image. */
    async loadMediaSizes() {
        if (this.mediaSizes === undefined) {
            const parsed = await readJsonFile(this.mediaSizesPath, {}, this.corruptReporter('media-sizes.json'));
            this.mediaSizes = isPlainObject(parsed) ? parsed : {};
        }
        return this.mediaSizes;
    }
    async saveMediaSize(name, size) {
        const sizes = await this.loadMediaSizes();
        // Re-insert so the map's insertion order doubles as recency, and trim
        // the oldest entries: this file used to grow for every upload ever.
        delete sizes[name];
        sizes[name] = size;
        trimMap(sizes, MAX_AUX_ENTRIES);
        await serialized(this.mediaSizesPath, () => writeJsonAtomic(this.mediaSizesPath, sizes));
    }
    /** Content-hash → file name index: re-uploading identical bytes reuses the
     * existing file instead of creating a duplicate. */
    async loadMediaHashes() {
        if (this.mediaHashes === undefined) {
            const parsed = await readJsonFile(this.mediaHashesPath, {}, this.corruptReporter('media-hashes.json'));
            this.mediaHashes = isPlainObject(parsed) ? parsed : {};
        }
        return this.mediaHashes;
    }
    async lookupMediaHash(hash) {
        return (await this.loadMediaHashes())[hash];
    }
    async saveMediaHash(hash, name) {
        const hashes = await this.loadMediaHashes();
        delete hashes[hash];
        hashes[hash] = name;
        trimMap(hashes, MAX_AUX_ENTRIES);
        await serialized(this.mediaHashesPath, () => writeJsonAtomic(this.mediaHashesPath, hashes));
    }
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Keep the newest `max` keys of an insertion-ordered object. */
function trimMap(map, max) {
    const keys = Object.keys(map);
    if (keys.length <= max)
        return;
    for (const key of keys.slice(0, keys.length - max))
        delete map[key];
}
/**
 * The slot list, accepting the pre-multi-slot shape (`{name,kind,source}`) as a
 * one-slot list so an existing selection survives the upgrade.
 */
function parseSlots(parsed) {
    if (typeof parsed !== 'object' || parsed === null)
        return [];
    const raw = Array.isArray(parsed.items) ? parsed.items : [parsed];
    const slots = [];
    for (const entry of raw) {
        if (entry === null) {
            slots.push(null);
            continue;
        }
        if (typeof entry !== 'object')
            continue;
        const { name, kind, source } = entry;
        if (typeof name !== 'string' || name === '') {
            slots.push(null);
            continue;
        }
        slots.push({
            name,
            kind: kind === 'video' || kind === 'audio' ? kind : 'image',
            source: source === 'generated' ? 'generated' : 'imported',
        });
    }
    return slots;
}