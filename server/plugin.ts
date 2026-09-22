import type { Plugin } from "vite";
import { WebSocketServer, type WebSocket } from "ws";
import { Lab } from "./lab.js";
import type { ClientMessage, ServerMessage } from "./protocol.js";

/**
 * Holds the session layer inside the Vite dev server, so `just dev` starts the
 * whole deck (S2). One Lab is shared by every connected socket: there is one
 * presenter, and a second browser tab should see the same database.
 */
export function labPlugin(): Plugin {
  return {
    name: "pgtalk-lab",
    configureServer(server) {
      const sockets = new Set<WebSocket>();
      const broadcast = (msg: ServerMessage) => {
        const text = JSON.stringify(msg);
        for (const ws of sockets) if (ws.readyState === ws.OPEN) ws.send(text);
      };

      const lab = new Lab(broadcast);
      const ready = lab.start().catch((err) => {
        broadcast({ type: "fatal", message: String(err) });
        throw err;
      });

      const wss = new WebSocketServer({ noServer: true });
      server.httpServer?.on("upgrade", (req, socket, head) => {
        if (new URL(req.url!, "http://localhost").pathname !== "/lab") return;
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
      });

      wss.on("connection", (ws) => {
        sockets.add(ws);
        ws.on("close", () => sockets.delete(ws));
        ws.on("message", async (data) => {
          const msg = JSON.parse(String(data)) as ClientMessage;
          try {
            await ready;
            if (msg.type === "run") await lab.run(msg.blockId, msg.session, msg.sql);
            else if (msg.type === "cancel") await lab.cancel(msg.session);
            else if (msg.type === "restore") await lab.restore(msg.fixture);
          } catch (err) {
            broadcast({ type: "fatal", message: String(err) });
          }
        });
      });

      server.httpServer?.on("close", () => void lab.stop());
    },
  };
}
