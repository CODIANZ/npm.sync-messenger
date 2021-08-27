import * as net from "net";
import { map, Subject } from "rxjs";
import * as rx from "@codianz/rx";
import { log } from "../log";
import { ConnectionLike } from "../../src";

export class Connection implements ConnectionLike {
  private m_socket?: net.Socket;
  private m_data = new Subject<Buffer>();
  private m_closed = new Subject<void>();
  private m_sg = new rx.SubscriptionGroup(log);

  constructor(socket: net.Socket) {
    this.m_socket = socket;
    this.m_socket.on("data", (data) => {
      this.m_data.next(data);
    });
    this.m_socket.on("close", (hadError) => {
      log.error("close hadError", hadError);
      this.m_closed.next(void 0);
      this.finalize();
    });
    this.m_socket.on("error", (err) => {
      log.error("error", err);
      /** nothing to do */
    });
  }

  setClosedHandler(handler: () => void): void {
    // prettier-ignore
    this.m_sg.append(
      "setClosedHandler",
      this.m_closed
      .pipe(map(() => {
        log.debug("closed");
        handler();
      }))
    );
  }

  setReceiveMessageHandler(handler: (data: string) => void): void {
    // prettier-ignore
    this.m_sg.append(
      "setReceiveMessageHandler",
      this.m_data
      .pipe(map((data) => {
        const s = data.toString();
        log.debug("recv", s);
        handler(s);
      }))
    );
  }

  emitMessage(data: string): void {
    log.debug("send", data);
    this.m_socket?.write(data);
  }

  finalize(): void {
    if (this.m_socket) {
      this.m_socket?.removeAllListeners();
      this.m_socket?.destroy();
      this.m_socket = undefined;
    }
    this.m_sg.unsubscribeAll();
  }
}
