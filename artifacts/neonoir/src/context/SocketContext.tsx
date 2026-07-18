import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function SocketProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    socketRef.current = socket;

    function authenticate() {
      // Send the cryptographically-signed JWT access token — backend verifies it
      // before granting any socket permissions. Never send raw userId.
      const token = localStorage.getItem("accessToken");
      if (token) socket.emit("auth", token);
      socket.emit("join_global");
    }

    socket.on("connect", () => {
      setConnected(true);
      authenticate();
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("reconnect", () => {
      setConnected(true);
      authenticate();
    });

    socket.on("reconnect_attempt", () => {
      setConnected(false);
    });

    socket.on("reconnect_error", () => {
      setConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [userId]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
