import * as React from 'react';

// ✅ Patch BEFORE React tries to use it internally
(React as any).__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = {
  Dispatcher: {},
  CurrentDispatcher: {},
  ResponseStatus: 200,
};

// ✅ Only now import the RSC server API
export { renderToReadableStream } from 'react-server-dom-webpack/server.edge';