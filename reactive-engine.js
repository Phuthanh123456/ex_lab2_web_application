function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isHtmlTagName(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9-]*$/.test(value);
}

function isVNode(value) {
  if (!isPlainObject(value) || !isPlainObject(value.props) || !Array.isArray(value.children)) {
    return false;
  }

  if (value.type === 'TEXT_ELEMENT') {
    return typeof value.props.nodeValue === 'string' && value.children.length === 0;
  }

  return isHtmlTagName(value.type) && value.children.every(isVNode);
}

export function createTextElement(value) {
  return {
    type: 'TEXT_ELEMENT',
    props: { nodeValue: String(value) },
    children: [],
  };
}

export function createElement(type, props, ...children) {
  if (!isHtmlTagName(type)) {
    throw new TypeError('createElement type must be a valid HTML tag name.');
  }

  const sourceProps = props == null ? {} : props;
  if (!isPlainObject(sourceProps)) {
    throw new TypeError('createElement props must be an object, null, or undefined.');
  }

  const normalizedChildren = children.map((child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return createTextElement(child);
    }

    if (isVNode(child)) {
      return child;
    }

    throw new TypeError('createElement children must be VNodes, strings, or numbers.');
  });

  return {
    type,
    props: { ...sourceProps },
    children: normalizedChildren,
  };
}

export function renderToDOM(vnode) {
  if (!isVNode(vnode)) {
    throw new TypeError('renderToDOM expects a valid VNode.');
  }

  if (vnode.type === 'TEXT_ELEMENT') {
    return document.createTextNode(vnode.props.nodeValue);
  }

  const element = document.createElement(vnode.type);

  for (const [propName, propValue] of Object.entries(vnode.props)) {
    if (propValue === null || propValue === undefined) {
      continue;
    }

    if (propName === 'id' || propName === 'role' || propName === 'className') {
      if (typeof propValue !== 'string') {
        throw new TypeError(`The ${propName} prop must be a string.`);
      }

      const attributeName = propName === 'className' ? 'class' : propName;
      element.setAttribute(attributeName, propValue);
    } else if (propName === 'onClick') {
      if (typeof propValue !== 'function') {
        throw new TypeError('The onClick prop must be a function.');
      }

      element.addEventListener('click', propValue);
    }
  }

  for (const child of vnode.children) {
    element.appendChild(renderToDOM(child));
  }

  return element;
}

// Private positional state storage for useState.
const stateEngine = (() => {
  const stateStore = [];
  let cursor = 0;
  let mountedComponent = null;
  let mountRoot = null;

  function useState(initialValue) {
    const hookPosition = cursor;

    if (!Object.prototype.hasOwnProperty.call(stateStore, hookPosition)) {
      stateStore[hookPosition] = initialValue;
    }

    cursor += 1;

    function setState(nextValue) {
      const previousValue = stateStore[hookPosition];
      stateStore[hookPosition] = typeof nextValue === 'function'
        ? nextValue(previousValue)
        : nextValue;

      if (mountedComponent !== null) {
        rerenderApp();
      }
    }

    return [stateStore[hookPosition], setState];
  }

  function resetCursor() {
    cursor = 0;
  }

  function rerenderApp() {
    if (mountedComponent === null || mountRoot === null) {
      throw new Error('Cannot rerender before an app has been mounted.');
    }

    resetCursor();
    const vnode = mountedComponent();
    mountRoot.replaceChildren(renderToDOM(vnode));
  }

  function mountApp(component, root) {
    if (typeof component !== 'function') {
      throw new TypeError('mountApp component must be a function.');
    }

    if (root === null || root === undefined || typeof root.replaceChildren !== 'function') {
      throw new TypeError('mountApp root must support replaceChildren().');
    }

    mountedComponent = component;
    mountRoot = root;
    rerenderApp();
  }

  return { useState, resetCursor, mountApp, rerenderApp };
})();

export const resetCursor = stateEngine.resetCursor;
export const useState = stateEngine.useState;
export const mountApp = stateEngine.mountApp;
export const rerenderApp = stateEngine.rerenderApp;
