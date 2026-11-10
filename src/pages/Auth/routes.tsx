import type { RouteObject } from 'react-router'
import { LoginPage } from './LoginPage'

/** Rendered under AuthLayout, outside the guarded app shell. */
export const authRoutes: RouteObject[] = [{ path: 'login', element: <LoginPage /> }]
