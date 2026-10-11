import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

class FakeText {
  constructor(value) {
    this.nodeType = 3;
    this.nodeValue = String(value);
    this.parentElement = null;
  }

  get textContent() {
    return this.nodeValue;
  }
}

class FakeElement {
  constructor(tagName) {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.childNodes = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.listeners = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  get textContent() {
    return this.childNodes.map((child) => child.textContent).join('');
  }

  appendChild(child) {
    child.parentElement = this;
    this.childNodes.push(child);
    return child;
  }

  replaceChildren(...children) {
    for (const child of this.childNodes) child.parentElement = null;
    this.childNodes = [];
    for (const child of children) this.appendChild(child);
  }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }

  removeEventListener(type, callback) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== callback));
  }

  matches(selector) {
    if (selector.startsWith('#')) return this.getAttribute('id') === selector.slice(1);
    if (selector.startsWith('.')) {
      return (this.getAttribute('class') || '').split(/\s+/).includes(selector.slice(1));
    }
    return this.tagName === selector.toUpperCase();
  }

  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType !== 1) continue;
        if (child.matches(selector)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  dispatchClick(target) {
    for (const callback of this.listeners.get('click') || []) {
      callback({ type: 'click', target });
    }
  }
}

const scenario = process.argv[2] || 'success';
const searchByScenario = {
  success: '',
  retry: '?fail=once',
  empty: '?fixture=empty',
  html: '?fixture=html',
  'html-error': '?fixture=html-error',
  cancel: '',
};
const appPath = resolve(process.cwd(), 'app.js');
const root = new FakeElement('div');
root.setAttribute('id', 'app');
const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
let requestCount = 0;
globalThis.setTimeout = (callback, delay, ...args) => {
  if (delay === 1000) {
    requestCount += 1;
    return nativeSetTimeout(callback, 15, ...args);
  }
  return nativeSetTimeout(callback, delay, ...args);
};

const NativeAbortController = globalThis.AbortController;
const controllers = [];
globalThis.AbortController = class extends NativeAbortController {
  constructor() {
    super();
    controllers.push(this);
  }
};

globalThis.document = {
  getElementById(id) {
    return id === 'app' ? root : root.querySelector('#' + id);
  },
  createElement(tagName) {
    return new FakeElement(tagName);
  },
  createTextNode(value) {
    return new FakeText(value);
  },
};
globalThis.window = { location: { search: searchByScenario[scenario] } };

async function runRaceHarness() {
  const appSource = await readFile(appPath, 'utf8');
  assert.match(appSource, /if \(!requestCoordinator\.isCurrent\(request\)\) return;/);

  const coordinatorMatch = appSource.match(
    /const requestCoordinator = (\(\(\) => \{[\s\S]*?\}\)\(\));/
  );
  assert.ok(coordinatorMatch, 'the app coordinator closure is present');
  const coordinator = new Function('return ' + coordinatorMatch[1] + ';')();
  let visibleResult = null;

  const requestA = coordinator.start();
  let resolveA;
  const responseA = new Promise((resolvePromise) => { resolveA = resolvePromise; });
  const applyA = (async () => {
    const result = await responseA;
    if (coordinator.isCurrent(requestA)) visibleResult = result;
    coordinator.finish(requestA);
  })();

  // Model cancellation/invalidation of A while a transport still returns late.
  requestA.controller.abort();
  coordinator.finish(requestA);

  const requestB = coordinator.start();
  assert.ok(requestB.id > requestA.id);
  let resolveB;
  const responseB = new Promise((resolvePromise) => { resolveB = resolvePromise; });
  const applyB = (async () => {
    const result = await responseB;
    if (coordinator.isCurrent(requestB)) visibleResult = result;
    coordinator.finish(requestB);
  })();

  resolveB('result B');
  await applyB;
  resolveA('stale result A');
  await applyA;
  assert.equal(visibleResult, 'result B');
  console.log('PASS race harness: late response A did not overwrite B');
}

if (scenario === 'race') {
  await runRaceHarness();
  process.exit(0);
}

await import(pathToFileURL(appPath).href + '?harness=' + scenario);
const wait = (milliseconds = 35) => new Promise((resolvePromise) => {
  nativeSetTimeout(resolvePromise, milliseconds);
});
const click = (target) => root.dispatchClick(target);
const feedState = () => root.querySelector('#feed-state');
const listenerCount = () => (root.listeners.get('click') || []).length;

assert.ok(root.querySelector('#load-feed'), 'initial IDLE contains Load Data');
assert.equal(feedState().getAttribute('aria-busy'), 'false');
assert.equal(listenerCount(), 1, 'mount installs one root click listener');

const originalLoadButton = root.querySelector('#load-feed');
assert.equal((originalLoadButton.listeners.get('click') || []).length, 0);
click(originalLoadButton);
assert.equal(feedState().getAttribute('aria-busy'), 'true');
assert.ok(root.querySelector('.feed-skeleton'), 'LOADING contains skeleton');
assert.equal(root.querySelector('.feed-skeleton').getAttribute('aria-hidden'), 'true');
assert.match(root.textContent, /Loading feed items\./);
assert.equal(root.querySelector('#load-feed'), null);
assert.equal(root.querySelector('#retry-feed'), null);

if (scenario === 'success' || scenario === 'retry') {
  for (let count = 0; count < 4; count += 1) click(originalLoadButton);
  assert.equal(requestCount, 1, 'duplicate/stale clicks did not start another request');
  assert.equal(listenerCount(), 1, 'rerender did not add a root listener');
  await wait();

  if (scenario === 'retry') {
    const alert = feedState().querySelector('p');
    assert.equal(alert.getAttribute('role'), 'alert');
    assert.match(alert.textContent, /Simulated request failure/);
    const retryButton = root.querySelector('#retry-feed');
    assert.equal(retryButton.textContent, 'Retry Connection');
    assert.equal((retryButton.listeners.get('click') || []).length, 0);
    click(retryButton);
    assert.equal(feedState().getAttribute('aria-busy'), 'true');
    for (let count = 0; count < 4; count += 1) click(retryButton);
    assert.equal(requestCount, 2, 'retry started exactly one request');
    await wait();
  }

  assert.equal(feedState().getAttribute('aria-busy'), 'false');
  assert.equal(root.querySelector('.feed-skeleton'), null);
  assert.equal(root.querySelectorAll('li').length, 3);
  assert.equal(listenerCount(), 1);
  console.log('PASS ' + scenario + ': IDLE, LOADING, and SUCCESS' + (scenario === 'retry' ? ' with ERROR and retry' : ''));
} else if (scenario === 'empty') {
  await wait();
  assert.equal(feedState().getAttribute('aria-busy'), 'false');
  assert.match(root.textContent, /No feed items are available\./);
  assert.equal(root.querySelector('ul'), null);
  assert.equal(root.querySelector('.feed-skeleton'), null);
  console.log('PASS empty fixture: empty data renders the SUCCESS empty message');
} else if (scenario === 'html') {
  await wait();
  assert.ok(root.textContent.includes('<img onerror=alert(1)> Safe Text <script>alert(1)</script>'));
  assert.equal(root.querySelector('img'), null);
  assert.equal(root.querySelector('script'), null);
  console.log('PASS HTML data fixture: markup is text; no img/script elements');
} else if (scenario === 'html-error') {
  await wait();
  const alert = feedState().querySelector('p');
  assert.equal(alert.getAttribute('role'), 'alert');
  assert.ok(alert.textContent.includes('<img onerror=alert(1)> <script>alert(1)</script> Safe error text'));
  assert.equal(root.querySelector('img'), null);
  assert.equal(root.querySelector('script'), null);
  assert.equal(root.querySelector('#retry-feed').textContent, 'Retry Connection');
  console.log('PASS HTML error fixture: error markup is text; no img/script elements');
} else if (scenario === 'cancel') {
  assert.equal(controllers.length, 1);
  controllers[0].abort();
  await wait(2);
  assert.equal(feedState().getAttribute('aria-busy'), 'true');
  assert.equal(feedState().querySelector('p').getAttribute('role'), 'status');
  assert.equal(root.querySelector('#retry-feed'), null);
  console.log('PASS cancellation: AbortError was not shown as a connection error');
}

globalThis.setTimeout = nativeSetTimeout;
globalThis.AbortController = NativeAbortController;
