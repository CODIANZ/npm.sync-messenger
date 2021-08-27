import { map, Subject } from "rxjs";
import * as rx from "@codianz/rx";
import { ConnectionLike } from "../../src";
import { log } from "../log";
import { SocketIOEssential } from "./SocketIOEssential";

export class Connection implements ConnectionLike {
  private m_socket: SocketIOEssential;
  private m_data = new Subject<Buffer>();
  private m_closed = new Subject<void>();
  private m_sg = new rx.SubscriptionGroup(log);
  private m_cleanupListners: () => void;

  constructor(socket: SocketIOEssential, cleanupListners: () => void) {
    this.m_socket = socket;
    this.m_cleanupListners = cleanupListners;
    this.m_socket.on("$SyncMessenger", (data) => {
      this.m_data.next(data);
    });
    this.m_socket.on("disconnect", () => {
      log.error("disconnect");
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
    this.m_socket?.emit("$SyncMessenger", data);
  }

  finalize(): void {
    this.m_cleanupListners();
    this.m_sg.unsubscribeAll();
  }
}
