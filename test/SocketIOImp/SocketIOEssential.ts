type on_types = {
  $SyncMessenger: any;
  disconnect: void;
  error: Error;
};

type type_t = keyof on_types;

export interface SocketIOEssential {
  on<T extends type_t>(type: T, handler: (resp: on_types[T]) => void): void;
  emit(event: string, ...args: any[]): void;
  removeAllListeners?(): void;
}
