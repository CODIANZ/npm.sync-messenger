import ws from "ws";
import { ClientLike, ConnectionLike } from "../../src";
import { Connection } from "./Connection";
import { log } from "../log";

export class Client implements ClientLike {
  private m_currentSocket?: ws;

  connect(onConnected: (connection?: ConnectionLike) => void): void {
    log.info("Client.connect");
    const socket = new ws("ws://localhost:4002/");
    socket.on("open", () => {
      log.info("open");
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
    this.m_currentSocket?.close();
  }
}
