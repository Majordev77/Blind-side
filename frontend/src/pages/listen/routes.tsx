import type { RouteObject } from 'react-router-dom'
import { Path } from '@/router/paths'
import ListenPage from './listen'

export const listenRoutes: RouteObject[] = [
  { path: Path.Listen, element: <ListenPage /> },
]
