import * as io from "socket.io";
import { Subject } from "rxjs";
import { Connection } from "./Connection";
import { log } from "../log";
import { ConnectionLike, ServerLike } from "../../src";

export class Server implements ServerLike {
  private m_connected = new Subject<io.Socket>();

  onConnected(handler: (connection: ConnectionLike) => void): void {
    this.m_connected.subscribe({
      next: (socket) => {
        socket.on("error", (err) => {
          log.error("socket error", err);
        });
        socket.on("close", () => {
          log.info("socket closed");
        });
        handler(new Connection(socket, () => socket.removeAllListeners()));
      }
    });
  }

  constructor() {
    const serv = new io.Server();
    serv.listen(4001);
    serv.on("connect", (socket) => {
      this.m_connected.next(socket);
    });
  }
}
