import type { RouteObject } from 'react-router'
import { page } from '../../app/lazy'

/** Rendered under AuthLayout, outside the guarded app shell. */
export const authRoutes: RouteObject[] = [{ path: 'login', element: page(() => import('./LoginPage'), 'LoginPage') }]
