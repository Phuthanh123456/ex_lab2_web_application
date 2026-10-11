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

// Private positional storage used by the upcoming useState implementation.
const stateEngine = (() => {
  const stateStore = [];
  let cursor = 0;

  function readStateAtCurrentCursor(initialValue) {
    const hookPosition = cursor;
    cursor += 1;

    if (!Object.prototype.hasOwnProperty.call(stateStore, hookPosition)) {
      stateStore[hookPosition] = initialValue;
    }

    return stateStore[hookPosition];
  }

  function resetCursor() {
    cursor = 0;
  }

  return { readStateAtCurrentCursor, resetCursor };
})();

export const resetCursor = stateEngine.resetCursor;
