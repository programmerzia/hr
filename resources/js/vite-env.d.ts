/// <reference types="vite/client" />

import type { route as ziggyRoute } from 'ziggy-js'

declare global {
  /** Ziggy's route() helper, injected by `@routes` in app.blade.php. */
  var route: typeof ziggyRoute
}
