import * as io from "socket.io-client";
import { ClientLike, ConnectionLike } from "../../src";
import { Connection } from "./Connection";
import { log } from "../log";
import { client_option_t } from "../client_option";

export class Client implements ClientLike {
  private m_currentSocket?: io.Socket;
  private m_option: client_option_t;

  constructor(option: client_option_t) {
    this.m_option = option;
  }

  connect(onConnected: (connection?: ConnectionLike) => void): void {
    log.info("Client.connect");
    const socket = io.io(`http://${this.m_option.host}:${this.m_option.port}`, {
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
