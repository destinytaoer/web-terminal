import { Outlet } from "react-router-dom";

export function GlobalLayout() {
  return (
    <div>
      <Outlet />
    </div>
  );
}
