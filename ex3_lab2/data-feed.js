/** @typedef {{id: string, content: string}} FeedItem */

const MOCK_DELAY_MS = 1000;
const MOCK_FEED = Object.freeze([
  Object.freeze({ id: 'feed-1', content: 'Mini-React state transitions are explicit.' }),
  Object.freeze({ id: 'feed-2', content: 'Loading feedback helps explain asynchronous work.' }),
  Object.freeze({ id: 'feed-3', content: 'AbortSignal can cancel an in-flight request.' }),
]);
const MOCK_HTML_FEED = Object.freeze([
  Object.freeze({
    id: 'feed-html',
    content: '<img onerror=alert(1)> Safe Text <script>alert(1)</script>',
  }),
]);
const MOCK_HTML_ERROR = '<img onerror=alert(1)> <script>alert(1)</script> Safe error text';
const MOCK_FIXTURES = Object.freeze(['default', 'empty', 'html', 'html-error']);

function createAbortError() {
  if (typeof DOMException === 'function') {
    return new DOMException('Feed request was aborted.', 'AbortError');
  }

  const error = new Error('Feed request was aborted.');
  error.name = 'AbortError';
  return error;
}

function isAbortSignalLike(signal) {
  return signal !== null
    && typeof signal === 'object'
    && typeof signal.aborted === 'boolean'
    && typeof signal.addEventListener === 'function'
    && typeof signal.removeEventListener === 'function';
}

/**
 * Resolve a deterministic mock feed after about one second.
 * Use { shouldFail: true } or a named fixture to reproduce outcomes without randomness.
 * An AbortSignal cancels a pending request.
 *
 * @param {{signal?: AbortSignal, shouldFail?: boolean, fixture?: 'default' | 'empty' | 'html' | 'html-error'}} [options]
 * @returns {Promise<FeedItem[]>}
 */
export function fetchFeed(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    return Promise.reject(new TypeError('fetchFeed options must be an object.'));
  }

  const { signal, shouldFail = false, fixture = 'default' } = options;

  if (typeof shouldFail !== 'boolean') {
    return Promise.reject(new TypeError('shouldFail must be a boolean.'));
  }

  if (!MOCK_FIXTURES.includes(fixture)) {
    return Promise.reject(new TypeError('fixture must be default, empty, html, or html-error.'));
  }

  if (signal !== undefined && !isAbortSignalLike(signal)) {
    return Promise.reject(new TypeError('signal must be an AbortSignal.'));
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    let settled = false;
    let timeoutId;

    const cleanup = () => {
      signal?.removeEventListener('abort', handleAbort);
    };

    const handleAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      cleanup();
      reject(createAbortError());
    };

    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();

      if (shouldFail || fixture === 'html-error') {
        const message = fixture === 'html-error'
          ? MOCK_HTML_ERROR
          : 'Unable to load the feed. Simulated request failure.';
        reject(new Error(message));
        return;
      }

      const items = fixture === 'empty'
        ? []
        : fixture === 'html'
          ? MOCK_HTML_FEED
          : MOCK_FEED;
      resolve(items.map((item) => ({ ...item })));
    }, MOCK_DELAY_MS);

    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}
