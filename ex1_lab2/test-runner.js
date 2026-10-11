import { createElement, renderToDOM } from './mini-react.js';

const unsafeImageText = '<img onerror=alert(1)> Safe Text';
const vApp = createElement('main', { id: 'root-view', role: 'main' },
  createElement('header', { className: 'hero' },
    createElement('h1', null, 'Mini React Engine'),
    createElement('p', null, unsafeImageText)
  ),
  createElement('button', { onClick: () => console.log('Ping') }, 'Click')
);

const root = document.getElementById('app');
console.assert(root !== null, 'Mount failed: #app was not found.');
if (root === null) {
  throw new Error('Mount failed: #app was not found.');
}

root.replaceChildren(renderToDOM(vApp));

const main = root.firstElementChild;
const header = main?.children[0] ?? null;
const heading = header?.children[0] ?? null;
const paragraph = header?.children[1] ?? null;
const button = main?.children[1] ?? null;

console.assert(root.querySelector('button') !== null, 'Mount failed: button was not found.');
console.assert(main?.tagName === 'MAIN', 'Expected a <main> root element.');
console.assert(main?.getAttribute('id') === 'root-view', 'Expected main id="root-view".');
console.assert(main?.getAttribute('role') === 'main', 'Expected main role="main".');
console.assert(header?.tagName === 'HEADER', 'Expected <header> as a child of <main>.');
console.assert(header?.getAttribute('class') === 'hero', 'Expected header class="hero".');
console.assert(heading?.tagName === 'H1', 'Expected <h1> inside <header>.');
console.assert(heading?.textContent === 'Mini React Engine', 'Unexpected <h1> text.');
console.assert(paragraph?.tagName === 'P', 'Expected <p> inside <header>.');
console.assert(button?.tagName === 'BUTTON', 'Expected <button> as a child of <main>.');
console.assert(button?.textContent === 'Click', 'Unexpected button text.');

console.assert(paragraph?.textContent === unsafeImageText, 'The img markup should remain plain text.');
console.assert(paragraph?.firstChild?.nodeType === Node.TEXT_NODE, 'The p child should be a text node.');
console.assert(paragraph?.querySelector('img') === null, 'The text should not create an <img> element.');
console.assert(root.querySelector('img, script') === null, 'The app should contain no injected img or script elements.');

const scriptProbe = renderToDOM(createElement('p', null, '<script>alert(1)</script>'));
console.assert(scriptProbe.textContent === '<script>alert(1)</script>', 'The script markup should remain plain text.');
console.assert(scriptProbe.firstChild?.nodeType === Node.TEXT_NODE, 'The script probe child should be a text node.');
console.assert(scriptProbe.querySelector('script') === null, 'The script text should not create a <script> element.');

console.info('Checkpoint 1 verification checks loaded.');
