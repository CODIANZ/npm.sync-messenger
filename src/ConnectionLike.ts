export interface ConnectionLike {
  setReceiveMessageHandler(handler: (data: string) => void): void;
  setClosedHandler(handler: () => void): void;
  emitMessage(data: string): void;
  finalize(): void;
}
