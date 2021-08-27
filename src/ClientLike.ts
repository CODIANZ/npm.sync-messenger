import { ConnectionLike } from "./ConnectionLike";

export interface ClientLike {
  connect(onConnected: (connection?: ConnectionLike) => void): void;
}
