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
