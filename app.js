import { createElement, renderToDOM } from './reactive-engine.js';

const root = document.getElementById('app');
if (root === null) {
  throw new Error('Cannot mount Exercise 2: #app was not found.');
}

const appVNode = createElement('main', { id: 'exercise-2' },
  createElement('h1', null, 'Exercise 2: Reactive State Machine & Delegation Hub'),
  createElement('p', null, 'VNode engine ready.')
);

root.replaceChildren(renderToDOM(appVNode));
