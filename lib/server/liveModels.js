import { defaultUpstreamClient } from './upstream.js';
import { defaultSessionStore } from './session.js';
import { sanitizeLiveModels, sanitizeAccountDisplay } from './liveModelsSanitize.js';

export { sanitizeLiveModels, sanitizeAccountDisplay };

export function parseSseChunks(onEvent) {
  const MAX_BUFFER = 256 * 1024;
  let buffer = '';

  return function feed(chunk) {
    if (typeof chunk !== 'string') return;
    if (chunk.length > MAX_BUFFER) {
      buffer = '';
      return;
    }

    buffer += chunk;
    if (buffer.length > MAX_BUFFER) {
      buffer = '';
      return;
    }

    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() || '';

    for (const rawMessage of parts) {
      if (!rawMessage) continue;

      const lines = rawMessage.split(/\r?\n/);
      let eventType = 'message';
      const dataLines = [];

      for (const line of lines) {
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }

      if (dataLines.length > 0) {
        onEvent({ event: eventType, data: dataLines.join('\n') });
      }
    }
  };
}

export function createLiveModelsStream({
  upstreamToken,
  sessionToken,
  sessionStore = defaultSessionStore,
  abortSignal,
}) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let keepaliveTimer = null;
  let revalidateTimer = null;
  let expiryTimer = null;
  let reader = null;
  let upstreamAborted = false;
  let isClosed = false;
  let revalidating = false;
  let pendingSnapshot = null;

  const stream = new ReadableStream({
    async start(controller) {
      const abortCleanup = () => {
        if (upstreamAborted) return;
        upstreamAborted = true;
        if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
        if (revalidateTimer) { clearInterval(revalidateTimer); revalidateTimer = null; }
        if (expiryTimer) { clearTimeout(expiryTimer); expiryTimer = null; }
        if (reader) {
          reader.cancel().catch(() => {});
          reader = null;
        }
      };

      const safeSend = (payload, isStatus = false) => {
        if (isClosed || upstreamAborted) return false;
        try {
          const prefix = isStatus ? 'event: status\ndata: ' : 'data: ';
          const chunk = encoder.encode(`${prefix}${JSON.stringify(payload)}\n\n`);
          if (controller.desiredSize <= 0 && !isStatus) {
            pendingSnapshot = chunk;
          } else {
            controller.enqueue(chunk);
          }
          return true;
        } catch {
          abortCleanup();
          return false;
        }
      };

      const sendAndClose = (statusPayload) => {
        if (isClosed) return;
        isClosed = true;
        abortCleanup();
        try {
          controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify(statusPayload)}\n\n`));
          controller.close();
        } catch {}
      };

      const isSessionValid = () => {
        if (!sessionToken || !sessionStore) return false;
        return Boolean(sessionStore.getSession(sessionToken));
      };

      if (!isSessionValid() || abortSignal?.aborted) {
        sendAndClose({ status: 'unauthenticated', receivedAt: new Date().toISOString() });
        return;
      }

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          isClosed = true;
          abortCleanup();
          try { controller.close(); } catch {}
        }, { once: true });
      }

      const initialSession = sessionStore.getSession(sessionToken);
      if (initialSession?.expiresAt) {
        const msLeft = new Date(initialSession.expiresAt).getTime() - Date.now();
        if (msLeft <= 0) {
          sendAndClose({ status: 'unauthenticated', receivedAt: new Date().toISOString() });
          return;
        }
        expiryTimer = setTimeout(() => {
          sendAndClose({ status: 'unauthenticated', receivedAt: new Date().toISOString() });
        }, msLeft);
      }

      const feed = parseSseChunks(({ data }) => {
        if (!isSessionValid()) {
          sendAndClose({ status: 'unauthenticated', receivedAt: new Date().toISOString() });
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const sanitized = sanitizeLiveModels(parsed);
          safeSend(sanitized, false);
        } catch {}
      });

      try {
        const upstreamRes = await defaultUpstreamClient.request(
          '/api/usage/stream',
          {
            method: 'GET',
            headers: { Accept: 'text/event-stream' },
            signal: abortSignal,
          },
          upstreamToken
        );

        if (!upstreamRes.ok) {
          sendAndClose({ status: 'error', receivedAt: new Date().toISOString() });
          return;
        }

        reader = upstreamRes.body?.getReader();
        if (!reader) {
          sendAndClose({ status: 'error', receivedAt: new Date().toISOString() });
          return;
        }

        keepaliveTimer = setInterval(() => {
          if (!isSessionValid()) {
            sendAndClose({ status: 'unauthenticated', receivedAt: new Date().toISOString() });
            return;
          }
          if (isClosed || upstreamAborted) return;
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch {
            abortCleanup();
          }
        }, 15000);

        revalidateTimer = setInterval(async () => {
          if (revalidating || isClosed || upstreamAborted) return;
          revalidating = true;
          try {
            const res = await defaultUpstreamClient.revalidateAuthResult(upstreamToken);
            if (res.status === 'unauthenticated') {
              sendAndClose({ status: 'unauthenticated', receivedAt: new Date().toISOString() });
            } else if (res.status === 'error') {
              sendAndClose({ status: 'error', receivedAt: new Date().toISOString() });
            }
          } catch {
            sendAndClose({ status: 'error', receivedAt: new Date().toISOString() });
          } finally {
            revalidating = false;
          }
        }, 60000);

        (async () => {
          try {
            while (!upstreamAborted && !isClosed) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                feed(decoder.decode(value, { stream: true }));
              }
            }
          } catch {
            if (!upstreamAborted && !isClosed) {
              safeSend({ status: 'error', receivedAt: new Date().toISOString() }, true);
            }
          } finally {
            abortCleanup();
            if (!isClosed) {
              isClosed = true;
              try { controller.close(); } catch {}
            }
          }
        })();
      } catch (err) {
        abortCleanup();
        if (err.status === 503 || err.code === 'UPSTREAM_UNAVAILABLE') {
          sendAndClose({ status: 'error', receivedAt: new Date().toISOString() });
        } else {
          controller.error(err);
        }
      }
    },

    pull(controller) {
      if (pendingSnapshot && !isClosed && controller.desiredSize > 0) {
        const chunk = pendingSnapshot;
        pendingSnapshot = null;
        try { controller.enqueue(chunk); } catch {}
      }
    },

    cancel() {
      isClosed = true;
      if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
      if (revalidateTimer) { clearInterval(revalidateTimer); revalidateTimer = null; }
      if (expiryTimer) { clearTimeout(expiryTimer); expiryTimer = null; }
      if (reader) {
        reader.cancel().catch(() => {});
        reader = null;
      }
    },
  });

  return stream;
}
