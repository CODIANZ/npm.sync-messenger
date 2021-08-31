import ws from "ws";
import { Subject } from "rxjs";
import { Connection } from "./Connection";
import { log } from "../log";
import { ConnectionLike, ServerLike } from "../../src";

export class Server implements ServerLike {
  private m_connected = new Subject<ws>();

  onConnected(handler: (connection: ConnectionLike) => void): void {
    this.m_connected.subscribe({
      next: (socket) => {
        socket.on("error", (err) => {
          log.error("socket error", err);
        });
        socket.on("close", () => {
          log.info("socket closed");
        });
        handler(new Connection(socket));
      }
    });
  }

  constructor() {
    new ws.Server({
      port: 4002
    }).on("connection", (socket) => {
      this.m_connected.next(socket);
    });
  }
}
