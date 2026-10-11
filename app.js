import { createElement, mountApp, useState } from './reactive-engine.js';
import { createInitialViewState, transitionViewState } from './data-feed-state.js';
import { fetchFeed } from './data-feed.js';

const root = document.getElementById('app');
if (root === null) {
  throw new Error('Cannot mount Exercise 3: #app was not found.');
}

// This coordinator survives component rerenders because it lives at module scope.
const requestCoordinator = (() => {
  let nextRequestId = 0;
  let activeRequest = null;

  return {
    start() {
      if (activeRequest !== null) return null;

      const request = {
        id: ++nextRequestId,
        controller: new AbortController(),
      };
      activeRequest = request;
      return request;
    },
    isCurrent(request) {
      return activeRequest !== null && activeRequest.id === request.id;
    },
    finish(request) {
      if (activeRequest !== null && activeRequest.id === request.id) {
        activeRequest = null;
      }
    },
  };
})();

const failureMode = new URLSearchParams(window.location.search).get('fail');
const fixture = new URLSearchParams(window.location.search).get('fixture') || 'default';
const alwaysFail = failureMode === '1' || failureMode === 'always';
let failOnceAvailable = failureMode === 'once';

function shouldSimulateFailure() {
  if (alwaysFail) return true;
  if (!failOnceAvailable) return false;

  failOnceAvailable = false;
  return true;
}

function errorMessageFrom(error) {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }

  if (typeof error === 'string' && error.trim() !== '') {
    return error;
  }

  return 'Unable to load the feed. Please try again.';
}

function isAbortError(error) {
  return error !== null
    && typeof error === 'object'
    && error.name === 'AbortError';
}

function DataFeed() {
  const [viewState, setViewState] = useState(createInitialViewState());

  async function loadData() {
    const request = requestCoordinator.start();
    if (request === null) return;

    try {
      setViewState((currentState) => transitionViewState(
        currentState,
        { status: 'LOADING' }
      ));

      const data = await fetchFeed({
        signal: request.controller.signal,
        shouldFail: shouldSimulateFailure(),
        fixture,
      });

      if (!requestCoordinator.isCurrent(request)) return;

      setViewState((currentState) => transitionViewState(
        currentState,
        { status: 'SUCCESS', data }
      ));
    } catch (error) {
      if (!requestCoordinator.isCurrent(request) || isAbortError(error)) {
        return;
      }

      setViewState((currentState) => transitionViewState(
        currentState,
        { status: 'ERROR', error: errorMessageFrom(error) }
      ));
    } finally {
      requestCoordinator.finish(request);
    }
  }

  let feedContent;

  if (viewState.status === 'IDLE') {
    feedContent = createElement('section', {
      id: 'feed-state',
      role: 'region',
      'aria-busy': false,
      className: 'feed-state',
    },
      createElement('p', null, 'Load the feed to view its items.'),
      createElement('button', { id: 'load-feed', onClick: loadData }, 'Load Data')
    );
  } else if (viewState.status === 'LOADING') {
    const skeletonItems = Array.from({ length: 3 }, () => createElement(
      'li',
      { className: 'skeleton-card' },
      createElement('span', { className: 'skeleton-line skeleton-line--title' }),
      createElement('span', { className: 'skeleton-line skeleton-line--detail' })
    ));

    feedContent = createElement('section', {
      id: 'feed-state',
      role: 'region',
      'aria-busy': true,
      className: 'feed-state feed-state--loading',
    },
      createElement('p', { role: 'status', className: 'sr-only' }, 'Loading feed items.'),
      createElement('ul', {
        className: 'feed-skeleton',
        'aria-hidden': true,
      }, ...skeletonItems)
    );
  } else if (viewState.status === 'SUCCESS') {
    feedContent = createElement('section', {
      id: 'feed-state',
      role: 'region',
      'aria-busy': false,
      className: 'feed-state',
    },
      viewState.data.length === 0
        ? createElement('p', null, 'No feed items are available.')
        : createElement('ul', null,
          ...viewState.data.map((item) => createElement('li', { id: item.id },
            createElement('p', null, item.content)
          ))
        )
    );
  } else {
    feedContent = createElement('section', {
      id: 'feed-state',
      role: 'region',
      'aria-busy': false,
      className: 'feed-state',
    },
      createElement('p', { role: 'alert' }, viewState.error),
      createElement('button', { id: 'retry-feed', onClick: loadData }, 'Retry Connection')
    );
  }

  return createElement('main', { id: 'exercise-3' },
    createElement('header', null,
      createElement('h1', null, 'Exercise 3: Resilient State Machine & Skeleton Loader')
    ),
    feedContent
  );
}

mountApp(DataFeed, root);
