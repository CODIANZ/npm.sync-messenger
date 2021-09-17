import ws from "ws";
import { ClientLike, ConnectionLike } from "../../src";
import { Connection } from "./Connection";
import { log } from "../log";
import { client_option_t } from "../client_option";

export class Client implements ClientLike {
  private m_currentSocket?: ws;
  private m_option: client_option_t;

  constructor(option: client_option_t) {
    this.m_option = option;
  }

  connect(onConnected: (connection?: ConnectionLike) => void): void {
    log.info("Client.connect");
    const socket = new ws(`ws://${this.m_option.host}:${this.m_option.port}/`);
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
