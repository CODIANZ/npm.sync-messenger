import * as net from "net";
import { ClientLike, ConnectionLike } from "../../src";
import { Connection } from "./Connection";
import { log } from "../log";

export class Client implements ClientLike {
  private m_currentSocket?: net.Socket;

  connect(onConnected: (connection?: ConnectionLike) => void): void {
    log.info("Client.connect");
    const socket = net.createConnection({ port: 4000 });
    socket.on("connect", () => {
      log.info("connected");
      this.m_currentSocket = socket;
      onConnected(new Connection(socket));
    });
    socket.on("error", (err) => {
      log.error("error", err);
      onConnected(undefined);
    });
  }

  public debugDisconnect() {
    log.info("Client.debugDisconnect");
    this.m_currentSocket?.destroy(new Error("debugDisconnect"));
  }
}
