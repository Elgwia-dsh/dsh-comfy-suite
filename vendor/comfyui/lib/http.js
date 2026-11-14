/** Send a JSON response with no-store caching. */
export function sendJson(response, status, body) {
    const payload = JSON.stringify(body);
    response.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
    });
    response.end(payload);
}
/** Read and parse a JSON request body; undefined when the body is empty. */
export async function readJsonBody(request, maxBytes = 0) {
    const buffer = await readRawBody(request, maxBytes);
    const text = buffer.toString('utf8');
    if (text === '')
        return undefined;
    return JSON.parse(text);
}
/**
 * Read a raw (possibly binary) request body, e.g. for multipart forwarding.
 *
 * `maxBytes` is enforced while streaming, not after buffering: a request that
 * exceeds the budget has already cost its bytes in heap otherwise. Uploads go
 * through here, so an uncapped limit means one huge file can take the host down.
 * A body over the limit rejects with `error.code === 'E_TOO_LARGE'` and the
 * request is destroyed so the sender stops writing.
 */
export async function readRawBody(request, maxBytes = 0) {
    const chunks = [];
    let total = 0;
    for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.byteLength;
        if (maxBytes > 0 && total > maxBytes) {
            const error = new Error(`request body exceeds ${maxBytes} bytes`);
            error.code = 'E_TOO_LARGE';
            error.status = 413;
            request.destroy();
            throw error;
        }
        chunks.push(buffer);
    }
    return Buffer.concat(chunks);
}
/** Whether a request originates from the page that served it (Origin vs Host). */
export function sameOrigin(request) {
    const origin = request.headers.origin;
    const host = request.headers.host;
    if (origin === undefined)
        return true;
    if (host === undefined)
        return false;
    return origin === `http://${host}` || origin === `https://${host}`;
}
/** Human-readable error message from an unknown thrown value. */
export function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}