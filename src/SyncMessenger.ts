import { of, Subject, Observable, Subscription, NEVER } from "rxjs";
import { mergeMap, take, map, takeWhile, catchError } from "rxjs/operators";
import { v4 as uuid } from "uuid";
import { ServerLike } from "./ServerLike";
import { ClientLike } from "./ClientLike";
import { ConnectionLike } from "./ConnectionLike";
import * as rx from "@codianz/rx";
import * as loglike from "@codianz/loglike";
import { ReconnectableConnection } from "./ReconnectableConnection";

type messageType_t =
  | "solicitedMessage"
  | "solicitedResponse"
  | "unsolicitedMessage";

type message_t = {
  kind: "$message";
  index: number /* "number" is it sender specify sequential  */;
  message_type: messageType_t /* "type" is a message "solicited" or "unsolicited" */;
  solicitedMessgeIndex?: number /* the number which is the index of "solicitedMessage" for "solicitedResponse" */;
  body: string /* main contents in a message */;
};

type ack_t = {
  kind: "$ack";
  index: number;
};

type hello_t = {
  kind: "$hello";
  sessionId: string;
  bFirst: boolean;
};

type syncMessengerData_t = message_t | ack_t | hello_t;

function isSyncMessengerData(data: unknown): data is syncMessengerData_t {
  const kind = (data as any)["kind"];
  return kind === "$message" || kind === "$ack" || kind === "$hello";
}

type config_t = {
  readonly timeoutSeconds: number;
  readonly retryIntervalSeconds: number;
  readonly log: loglike.LogLike;
};

export class SyncMessenger {
  private static s_sockets: { [_: string]: SyncMessenger } = {};
  public static get Sockets() {
    return SyncMessenger.s_sockets;
  }
  public static findBySessionId(sessionId: string) {
    if (sessionId in this.Sockets) {
      return this.Sockets[sessionId];
    }
    return null;
  }

  public static get DefaultConfig(): config_t {
    return {
      timeoutSeconds: 15,
      retryIntervalSeconds: 5,
      log: loglike.Null
    };
  }

  private m_sg: rx.SubscriptionGroup;
  private m_messageObservableSubscription?: Subscription;
  private m_config: config_t;
  private m_connection: ConnectionLike;
  private m_sessionId: string;
  private m_messageIndex: number = 0;
  private m_lastReceiveMessageIndex: number = 0;
  private m_ackMessage = new Subject<ack_t>();
  private m_message = new Subject<message_t>();

  private m_pendingSolicitedMessages: { [_: number]: message_t } = {};
  public get PendingSolicitedMessages() {
    return this.m_pendingSolicitedMessages;
  }

  public get SessionId() {
    return this.m_sessionId;
  }

  private static connectionMessageAsObservable(connection: ConnectionLike) {
    return new Observable<syncMessengerData_t>((o) => {
      connection.setReceiveMessageHandler((data) => {
        try {
          const jdata = JSON.parse(data);
          if (!isSyncMessengerData(jdata)) return;
          o.next(jdata);
        } catch {
          /** unknown data */
        }
      });
    });
  }

  private get log() {
    return this.m_config.log;
  }

  /* サーバ側の接続待機 */
  public static serverConnection(
    config: Partial<config_t>,
    server: ServerLike,
    onConnect: (syncSocket: SyncMessenger) => void
  ) {
    server.onConnected((connection) => {
      const messageObservable = this.connectionMessageAsObservable(connection);
      // prettier-ignore
      messageObservable
      .pipe(takeWhile((x) => x.kind === "$hello"))
      .subscribe({
        next: (data) => {
          if (data.kind !== "$hello") return;
          const hello = data;
          if (hello.sessionId in SyncMessenger.s_sockets) {
            const sm = SyncMessenger.s_sockets[hello.sessionId];
            sm.m_connection.finalize();
            sm.m_connection = connection;
            sm.resetObservers(messageObservable);
          } else {
            if (hello.bFirst) {
              const sm = new SyncMessenger(
                config,
                connection,
                hello.sessionId,
                messageObservable
              );
              SyncMessenger.s_sockets[hello.sessionId] = sm;
              onConnect(sm);
            }
          }
        }
      });
    });
  }

  /* クライアントからの接続 */
  public static clinentConnection(
    config: Partial<config_t>,
    client: ClientLike
  ) {
    const sessionId = uuid();
    const connection = new ReconnectableConnection(
      client,
      config.retryIntervalSeconds ??
        SyncMessenger.DefaultConfig.retryIntervalSeconds
    );
    const ss = new SyncMessenger(
      config,
      connection,
      sessionId,
      this.connectionMessageAsObservable(connection)
    );
    let bFirst = true;

    connection.continuousConnect(() => {
      const data: hello_t = {
        kind: "$hello",
        sessionId: sessionId,
        bFirst: bFirst
      };
      connection.emitMessage(JSON.stringify(data));
      bFirst = false;
    });

    return ss;
  }

  public goodbye() {
    this.log.info("goodbye");
    if (this.m_sessionId in SyncMessenger.s_sockets) {
      delete SyncMessenger.s_sockets[this.m_sessionId];
      this.goodbyeInternal("goodbye");
    } else {
      this.goodbyeInternal("goodbye (unmanaged session)");
    }
  }

  private goodbyeInternal(reason: string) {
    this.m_connection.finalize();
    this.m_sg.unsubscribeAll();
    this.m_ackMessage.error(new Error(reason));
    this.m_message.error(new Error(reason));
  }

  private constructor(
    config: Partial<config_t>,
    connection: ConnectionLike,
    sessionId: string,
    messageObservable: Observable<syncMessengerData_t>
  ) {
    this.m_config = { ...SyncMessenger.DefaultConfig, ...config };
    this.m_sg = new rx.SubscriptionGroup(this.m_config.log);
    this.m_sessionId = sessionId;
    this.m_connection = connection;
    this.log.info(`ctor sessionId = ${sessionId}`);
    this.resetObservers(messageObservable);
    this.m_sg.append(
      "tanking solicitedMessage",
      this.m_message.pipe(
        map((x) => {
          if (x.message_type == "solicitedMessage") {
            this.m_pendingSolicitedMessages[x.index] = x;
          }
        })
      )
    );
  }

  private resetObservers(messageObservable: Observable<syncMessengerData_t>) {
    if (this.m_messageObservableSubscription) {
      this.m_messageObservableSubscription.unsubscribe();
    }
    this.m_messageObservableSubscription = messageObservable.subscribe({
      next: (data) => {
        if (data.kind === "$ack") {
          this.m_ackMessage.next(data);
        } else if (data.kind === "$message") {
          const message = data;
          const ack: ack_t = {
            kind: "$ack",
            index: message.index
          };
          this.m_connection.emitMessage(JSON.stringify(ack));
          if (message.index != this.m_lastReceiveMessageIndex) {
            this.m_lastReceiveMessageIndex = message.index;
            this.log.info(`receive (${message.index})`);
            this.m_message.next(message);
          } else {
            this.log.info(`receive (${message.index}) : already received`);
          }
        }
      }
    });
  }

  public onUnsolicitedMessage(f: (body: string) => void) {
    // prettier-ignore
    this.m_sg.append(
        "onUnsolicitedMessage",
        this.m_message
        .pipe(map((x) => {
          if (x.message_type != "unsolicitedMessage") return "skip";
          f(x.body);
          return x;
        }))
    );
  }

  public onSolcitedMessage(f: (index: number, body: any) => void) {
    // prettier-ignore
    this.m_sg.append(
        "onSolcitedMessage",
        this.m_message
        .pipe(map((x) => {
          if (x.message_type != "solicitedMessage") return "skip";
          f(x.index, x.body);
          return x;
        }))
    );
  }

  public emitUnsolicitedMessage(body?: any) {
    return this.emitInternal(body, "unsolicitedMessage");
  }

  public emitSolicitedResponse(index: number, body?: any) {
    if (index in this.m_pendingSolicitedMessages) {
      delete this.m_pendingSolicitedMessages[index];
    } else {
      this.log.error(`emitSolicitedResponse missing index ${index}`);
    }
    return this.emitInternal(body, "solicitedResponse", index);
  }

  public emitSolicitedMessageAndWaitResponse(body?: unknown) {
    return new Promise<unknown>((resolve, reject) => {
      const targetIndex = this.m_messageIndex + 1;
      // prettier-ignore
      this.m_sg.append(
        "wait solicitedResponse",
        this.m_message
        .pipe(mergeMap((x) => {
          if (x.message_type != "solicitedResponse") return NEVER;
          if (x.solicitedMessgeIndex != targetIndex) return NEVER;
          return of(x);
        }))
        .pipe(take(1))
        .pipe(map((x) => {
          resolve(x.body);
        }))
        .pipe(catchError((err) => {
          reject(err);
          throw err;
        }))
      );

      // prettier-ignore
      this.emitInternal(body, "solicitedMessage")
      .then(() => {
        this.log.info("emitSolicitedMessageAndWaitResponse emit success");
      })
      .catch((err) => {
        this.log.error(
          `emitSolicitedMessageAndWaitResponse emit error ${err}`
        );
      });
    });
  }

  private emitInternal(
    body: any | undefined,
    type: messageType_t,
    solicitedMessgeIndex?: number
  ) {
    this.m_messageIndex++;
    const index = this.m_messageIndex;
    this.log.info(`emit (${index})`);

    return new Promise<void>((resolve, reject) => {
      const message: message_t = {
        kind: "$message",
        index: index,
        message_type: type,
        solicitedMessgeIndex: solicitedMessgeIndex,
        body: body
      };

      const timer_retry = setInterval(() => {
        this.log.info(`emit (${index}) : retry`);
        this.m_connection.emitMessage(JSON.stringify(message));
      }, 1000 * this.m_config.retryIntervalSeconds);

      const timer_timeout = setTimeout(() => {
        this.goodbyeInternal(`timeout ${this.m_config.timeoutSeconds} sec.`);
        reject("timeout");
      }, 1000 * this.m_config.timeoutSeconds);

      this.m_sg.append(
        "emitInternal",
        this.m_ackMessage
          .pipe(
            mergeMap((x) => {
              if (x.index == index) {
                return of(x);
              }
              return NEVER;
            })
          )
          .pipe(take(1))
          .pipe(
            map((x) => {
              clearInterval(timer_retry);
              clearTimeout(timer_timeout);
              this.log.info(`emit (${index}) : success`);
              resolve(void 0);
            })
          )
          .pipe(
            catchError((err) => {
              clearInterval(timer_retry);
              clearTimeout(timer_timeout);
              this.log.error(`emit (${index}) : error`);
              reject(err);
              throw err;
            })
          )
      );
      this.log.info(`emit (${index}) : send`);
      this.m_connection.emitMessage(JSON.stringify(message));
    });
  }
}
