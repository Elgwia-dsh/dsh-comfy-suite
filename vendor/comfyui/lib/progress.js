/**
 * Live generation telemetry, fed by ComfyUI's WebSocket.
 *
 * The server broadcasts a small event vocabulary to every connected client
 * (`status`, `execution_start`, `execution_cached`, `executing`, `progress`,
 * `execution_error`, `execution_success`, `execution_interrupted`). One shared
 * socket tracks every queued prompt — including ones the plugin did not
 * submit — so the panel and the tool cards can show what is actually happening
 * instead of guessing from the queue list alone.
 *
 * What is kept per prompt:
 *   • sampler progress (value/max of the node currently executing),
 *   • the node id that is executing right now,
 *   • lifecycle state + timestamps (started/ended), so elapsed time and a step
 *     rate are available,
 *   • the failure message when the prompt errored.
 *
 * Everything here is best-effort: a server behind an authenticating proxy (or
 * one that never connects) simply reports nothing, and callers fall back to
 * "queued"/"unknown". The maps are bounded so a long-running host cannot leak
 * one record per generated prompt.
 */

/** How many prompts to remember (progress + lifecycle records). */
const MAX_TRACKED = 200;
/** Reconnect backoff: start at 3 s, double up to a minute, reset on open. */
const RETRY_MIN_MS = 3_000;
const RETRY_MAX_MS = 60_000;

/**
 * Milliseconds per sampling step for one prompt, measured between the first
 * completed step and the latest one. Null until a second step lands — a single
 * data point would just repeat the wall clock (which includes weight loading).
 */
function stepRateMs(progress) {
    const firstStepAt = progress.firstStepAt;
    if (typeof firstStepAt !== 'number' || progress.value < 2)
        return null;
    const rate = (progress.updatedAt - firstStepAt) / (progress.value - 1);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export class ProgressTracker {
    /** promptId → { value, max, node, updatedAt, firstStepAt } */
    progress = new Map();
    /** promptId → { state, startedAt, endedAt, node, error } */
    life = new Map();
    socket = null;
    retryTimer = null;
    retryDelay = RETRY_MIN_MS;
    stopped = true;
    /** The URL the current socket was opened with (idempotent attach). */
    url = null;
    /** Last `status` event's queue_remaining, or null before the first one. */
    queueRemaining = null;
    /** Timestamp of the last message of any kind. */
    lastEventAt = 0;
    /** Current progress for one prompt, if the server reported any. */
    get(promptId) {
        return this.progress.get(promptId);
    }
    /** Whether the WebSocket is currently open (events are authoritative). */
    get connected() {
        return this.socket !== null;
    }
    /** Terminal state reported over the socket, or null while it is still running. */
    settlement(promptId) {
        const life = this.life.get(promptId);
        if (life === undefined || life.endedAt === null)
            return null;
        return { state: life.state, error: life.error };
    }
    /**
     * Everything known about one prompt, in the shape the panel renders.
     * `etaMs` is a straight-line estimate from the current node's step rate; it
     * is null until at least one step has been measured.
     */
    snapshot(promptId) {
        const progress = this.progress.get(promptId);
        const life = this.life.get(promptId);
        const now = Date.now();
        const startedAt = life?.startedAt ?? null;
        const endedAt = life?.endedAt ?? null;
        const elapsedMs = startedAt !== null ? Math.max(0, (endedAt ?? now) - startedAt) : null;
        let etaMs = null;
        if (progress !== undefined && progress.max > 0 && endedAt === null) {
            // Estimate from the *step rate*, not from total elapsed: a video model
            // spends two to three minutes loading weights before step 1, and
            // dividing that by the step count made a 4-step run predict ten
            // minutes of "remaining" after the first step. One measured step is
            // enough; before that there is no honest number to show.
            const perStep = stepRateMs(progress);
            if (perStep !== null)
                etaMs = Math.round(perStep * Math.max(0, progress.max - progress.value));
        }
        return {
            promptId,
            state: life?.state ?? (progress !== undefined ? 'running' : null),
            value: progress?.value ?? null,
            max: progress?.max ?? null,
            node: progress?.node ?? life?.node ?? null,
            startedAt,
            endedAt,
            elapsedMs,
            etaMs,
            error: life?.error ?? null,
            updatedAt: progress?.updatedAt ?? 0,
        };
    }
    /** Start listening on the server's /ws endpoint. Idempotent per url. */
    attach(wsUrl) {
        if (!this.stopped && this.socket !== null && this.url === wsUrl)
            return;
        this.stopped = false;
        if (this.url !== wsUrl) {
            // A different server: the old telemetry describes a foreign queue.
            this.progress.clear();
            this.life.clear();
            this.queueRemaining = null;
        }
        this.url = wsUrl;
        this.closeSocket();
        this.connect(wsUrl);
    }
    connect(wsUrl) {
        if (this.stopped)
            return;
        let socket;
        try {
            socket = new WebSocket(wsUrl);
        }
        catch {
            this.scheduleRetry(wsUrl);
            return;
        }
        this.socket = socket;
        socket.addEventListener('open', () => {
            if (this.socket !== socket)
                return;
            this.retryDelay = RETRY_MIN_MS;
            this.lastEventAt = Date.now();
        });
        socket.addEventListener('message', (event) => this.onMessage(event.data));
        socket.addEventListener('close', () => {
            if (this.socket === socket) {
                this.socket = null;
                this.scheduleRetry(wsUrl);
            }
        });
        socket.addEventListener('error', () => {
            try {
                socket.close();
            }
            catch {
                // close already in flight
            }
        });
    }
    onMessage(data) {
        this.lastEventAt = Date.now();
        // Text frames only: binary frames are ComfyUI's preview-image channel.
        if (typeof data !== 'string')
            return;
        let message = null;
        try {
            message = JSON.parse(data);
        }
        catch {
            return;
        }
        if (message?.type === undefined || typeof message.data !== 'object' || message.data === null)
            return;
        const payload = message.data;
        const promptId = typeof payload.prompt_id === 'string' ? payload.prompt_id : null;
        switch (message.type) {
            case 'status': {
                const remaining = payload.status?.exec_info?.queue_remaining;
                if (typeof remaining === 'number')
                    this.queueRemaining = remaining;
                return;
            }
            case 'execution_start': {
                if (promptId === null)
                    return;
                this.touch(promptId);
                this.life.set(promptId, { state: 'running', startedAt: Date.now(), endedAt: null, node: null, error: null });
                return;
            }
            case 'executing': {
                if (promptId === null)
                    return;
                const node = payload.node;
                // `node === null` is ComfyUI's "this prompt finished executing".
                if (node === null || node === undefined) {
                    const life = this.life.get(promptId);
                    if (life !== undefined && life.endedAt === null)
                        this.life.set(promptId, { ...life, state: 'completed', endedAt: Date.now() });
                    return;
                }
                this.touch(promptId);
                const life = this.life.get(promptId);
                this.life.set(promptId, {
                    state: 'running',
                    startedAt: life?.startedAt ?? Date.now(),
                    endedAt: null,
                    node: typeof node === 'number' || typeof node === 'string' ? node : null,
                    error: null,
                });
                // A new node means the previous node's step counter is stale.
                this.progress.delete(promptId);
                return;
            }
            case 'progress': {
                if (promptId === null)
                    return;
                const value = payload.value;
                const max = payload.max;
                if (typeof value !== 'number' || typeof max !== 'number')
                    return;
                this.touch(promptId);
                const previous = this.progress.get(promptId);
                const now = Date.now();
                this.progress.set(promptId, {
                    value,
                    max,
                    node: typeof payload.node === 'number' || typeof payload.node === 'string' ? payload.node : null,
                    updatedAt: now,
                    // When the first step of this node completed: the base of the
                    // step-rate estimate (weight loading is not part of it).
                    firstStepAt: value > 0 ? (previous?.firstStepAt ?? now) : null,
                });
                if (!this.life.has(promptId)) {
                    this.life.set(promptId, { state: 'running', startedAt: now, endedAt: null, node: null, error: null });
                }
                return;
            }
            case 'execution_error': {
                if (promptId === null)
                    return;
                const life = this.life.get(promptId);
                const text = typeof payload.exception_message === 'string' && payload.exception_message !== ''
                    ? payload.exception_message
                    : 'execution error';
                this.life.set(promptId, {
                    state: 'failed',
                    startedAt: life?.startedAt ?? Date.now(),
                    endedAt: Date.now(),
                    node: life?.node ?? null,
                    error: text.slice(0, 500),
                });
                this.progress.delete(promptId);
                return;
            }
            case 'execution_interrupted': {
                if (promptId === null)
                    return;
                const life = this.life.get(promptId);
                this.life.set(promptId, {
                    state: 'interrupted',
                    startedAt: life?.startedAt ?? Date.now(),
                    endedAt: Date.now(),
                    node: life?.node ?? null,
                    error: null,
                });
                this.progress.delete(promptId);
                return;
            }
            case 'execution_success': {
                if (promptId === null)
                    return;
                const life = this.life.get(promptId);
                this.life.set(promptId, {
                    state: 'completed',
                    startedAt: life?.startedAt ?? Date.now(),
                    endedAt: Date.now(),
                    node: life?.node ?? null,
                    error: null,
                });
                this.progress.delete(promptId);
                return;
            }
            default:
                return;
        }
    }
    /** Mark a prompt as recently touched and keep the maps bounded. */
    touch(promptId) {
        const record = this.progress.get(promptId);
        if (record !== undefined) {
            // Re-insert so Map insertion order stays a usable LRU order.
            this.progress.delete(promptId);
            this.progress.set(promptId, record);
        }
        while (this.progress.size > MAX_TRACKED) {
            const oldest = this.progress.keys().next().value;
            if (oldest === undefined)
                break;
            this.progress.delete(oldest);
        }
        while (this.life.size > MAX_TRACKED) {
            const oldest = this.life.keys().next().value;
            if (oldest === undefined)
                break;
            this.life.delete(oldest);
        }
    }
    scheduleRetry(wsUrl) {
        if (this.stopped || this.retryTimer !== null)
            return;
        const delay = this.retryDelay;
        this.retryDelay = Math.min(RETRY_MAX_MS, Math.round(delay * 2));
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.connect(wsUrl);
        }, delay);
        if (typeof this.retryTimer.unref === 'function')
            this.retryTimer.unref();
    }
    closeSocket() {
        if (this.retryTimer !== null) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        if (this.socket !== null) {
            const socket = this.socket;
            this.socket = null;
            try {
                socket.close();
            }
            catch {
                // already closed
            }
        }
    }
    dispose() {
        this.stopped = true;
        this.closeSocket();
        this.url = null;
    }
}