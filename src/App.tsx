import { Outlet } from "react-router";
import "./App.css";

export function App() {
  return (
    <main className="flex min-h-screen w-full flex-col bg-neutral-50 text-neutral-800">
      <Outlet />
    </main>
  );
}
