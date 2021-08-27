import * as io from "socket.io-client";
import { ClientLike, ConnectionLike } from "../../src";
import { Connection } from "./Connection";
import { log } from "../log";

export class Client implements ClientLike {
  private m_currentSocket?: io.Socket;

  connect(onConnected: (connection?: ConnectionLike) => void): void {
    log.info("Client.connect");
    const socket = io.io("http://localhost:4001", {
      reconnection: false
    });
    socket.on("connect", () => {
      log.info("connected");
      this.m_currentSocket = socket;
      onConnected(new Connection(socket, () => socket.off()));
    });
    socket.on("error", (err) => {
      log.error("error", err);
      onConnected(undefined);
      socket.offAny();
    });
    socket.on("connect_error", (err) => {
      log.error("error", err);
      onConnected(undefined);
    });
  }

  public debugDisconnect() {
    log.info("Client.debugDisconnect");
    this.m_currentSocket?.disconnect();
  }
}
