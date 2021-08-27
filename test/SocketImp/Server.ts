import * as net from "net";
import { Subject } from "rxjs";
import { Connection } from "./Connection";
import { log } from "../log";
import { ConnectionLike, ServerLike } from "../../src";

export class Server implements ServerLike {
  private m_connected = new Subject<net.Socket>();

  onConnected(handler: (connection: ConnectionLike) => void): void {
    this.m_connected.subscribe({
      next: (socket) => {
        socket.on("error", (err) => {
          log.error("socket error", err);
        });
        socket.on("close", (hadError) => {
          log.info("socket closed", hadError);
        });
        handler(new Connection(socket));
      }
    });
  }

  constructor() {
    net
      .createServer((socket) => {
        this.m_connected.next(socket);
      })
      .listen(4000);
  }
}
