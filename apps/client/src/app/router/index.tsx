import { createBrowserRouter } from 'react-router-dom'
import ErrorPage from './error'
import NotFoundPage from './404'
import { GlobalLayout } from '@/app/layout'
import { Home } from '@/modules/home'
import { NodePty } from '@/modules/node-pty'
import { ExecBase64, ExecBinary } from '@/modules/k8s'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <GlobalLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: '/',
        element: <Home />,
      },
      {
        path: '/node-pty/:shell',
        element: <NodePty />,
      },
      {
        path: '/exec-base64',
        element: <ExecBase64 />,
      },
      {
        path: '/exec-binary',
        element: <ExecBinary />,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
