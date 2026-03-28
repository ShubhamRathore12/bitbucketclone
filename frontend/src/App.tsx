import { Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useWebSocket } from "@/hooks/useWebSocket";

/**
 * Root application component.
 * Wraps all routed pages and provides global side-effects like WebSocket connection.
 */
export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Connect WebSocket for real-time notifications when authenticated
  useWebSocket(isAuthenticated);

  return <Outlet />;
}
