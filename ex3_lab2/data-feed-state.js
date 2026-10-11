/**
 * DataFeed state is one tagged object. The status discriminates which fields
 * are valid, so mutually contradictory loading/error flags cannot coexist.
 *
 * @template T
 * @typedef {{status: 'IDLE'} | {status: 'LOADING'} | {status: 'SUCCESS', data: T} | {status: 'ERROR', error: string}} ViewState
 */

const VIEW_STATE_FIELDS = Object.freeze({
  IDLE: ['status'],
  LOADING: ['status'],
  SUCCESS: ['status', 'data'],
  ERROR: ['status', 'error'],
});

const ALLOWED_TRANSITIONS = Object.freeze({
  IDLE: ['LOADING'],
  LOADING: ['SUCCESS', 'ERROR'],
  SUCCESS: ['LOADING'],
  ERROR: ['LOADING'],
});

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactFields(value, expectedFields) {
  const actualFields = Object.keys(value);
  return actualFields.length === expectedFields.length
    && expectedFields.every((field) => Object.prototype.hasOwnProperty.call(value, field));
}

/**
 * Validate one ViewState variant and return its status.
 * @param {unknown} state
 * @param {string} name
 * @returns {'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'}
 */
function assertViewState(state, name) {
  if (!isPlainObject(state) || typeof state.status !== 'string') {
    throw new TypeError(`${name} must be a plain ViewState object with a status.`);
  }

  if (!Object.prototype.hasOwnProperty.call(VIEW_STATE_FIELDS, state.status)) {
    throw new TypeError(`${name} has an unknown ViewState status.`);
  }

  const expectedFields = VIEW_STATE_FIELDS[state.status];
  if (!hasExactFields(state, expectedFields)) {
    throw new TypeError(`${name} does not match its ViewState variant.`);
  }

  if (state.status === 'ERROR' && typeof state.error !== 'string') {
    throw new TypeError(`${name}.error must be a string.`);
  }

  return state.status;
}

/**
 * Create the initial DataFeed state.
 * @template T
 * @returns {ViewState<T>}
 */
export function createInitialViewState() {
  return { status: 'IDLE' };
}

/**
 * Validate and apply one allowed DataFeed state transition.
 * @template T
 * @param {ViewState<T>} currentState
 * @param {ViewState<T>} nextState
 * @returns {ViewState<T>}
 * @throws {TypeError} If either value does not match a ViewState variant.
 * @throws {Error} If the transition is not allowed.
 */
export function transitionViewState(currentState, nextState) {
  const currentStatus = assertViewState(currentState, 'currentState');
  const nextStatus = assertViewState(nextState, 'nextState');

  if (!ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new Error(`Invalid DataFeed transition: ${currentStatus} -> ${nextStatus}.`);
  }

  return { ...nextState };
}
