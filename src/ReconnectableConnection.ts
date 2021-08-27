import { retry, Subject, Subscription } from "rxjs";
import { ClientLike } from "./ClientLike";
import { ConnectionLike } from "./ConnectionLike";

export class ReconnectableConnection implements ConnectionLike {
  private m_client: ClientLike;
  private m_retryInterval: number;
  private m_connection?: ConnectionLike;
  private m_onReceiveMessage = new Subject<string>();
  private m_onReceiveMessageSubscription?: Subscription;
  private m_bFinalized = false;

  constructor(client: ClientLike, retryInterval: number) {
    this.m_client = client;
    this.m_retryInterval = retryInterval;
  }

  private retryConnect(onConnected: () => void) {
    setTimeout(() => {
      this.continuousConnect(onConnected);
    }, this.m_retryInterval * 1000);
  }

  continuousConnect(onConnected: () => void) {
    if (this.m_bFinalized) return;
    this.m_client.connect((connection) => {
      if (!connection) {
        this.retryConnect(onConnected);
        return;
      }
      this.m_connection?.finalize();
      this.m_connection = connection;
      connection.setReceiveMessageHandler((data) => {
        this.m_onReceiveMessage.next(data);
      });
      connection.setClosedHandler(() => {
        this.m_connection = undefined;
        this.retryConnect(onConnected);
      });
      onConnected();
    });
  }

  setReceiveMessageHandler(handler: (data: string) => void): void {
    this.m_onReceiveMessageSubscription?.unsubscribe();
    this.m_onReceiveMessageSubscription = this.m_onReceiveMessage.subscribe({
      next: (data) => handler(data)
    });
  }

  setClosedHandler(handler: () => void): void {
    throw new Error("Method not implemented.");
  }

  emitMessage(data: string): void {
    this.m_connection?.emitMessage(data);
  }

  finalize(): void {
    this.m_bFinalized = true;
    this.m_onReceiveMessageSubscription?.unsubscribe();
  }
}
