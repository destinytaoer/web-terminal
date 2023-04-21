import { createBrowserRouter } from "react-router-dom";
import ErrorPage from "./error";
import NotFoundPage from "./404";
import { GlobalLayout } from "@/app/layout";
import { Home } from "@/modules/home";
import { NodePty } from "@/modules/node-pty";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <GlobalLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/node-pty",
        element: <NodePty />,
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
