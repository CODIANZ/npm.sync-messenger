import { ConnectionLike } from "./ConnectionLike";

export interface ServerLike {
  onConnected(handler: (connection: ConnectionLike) => void): void;
}
