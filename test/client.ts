import {
  asyncScheduler,
  BehaviorSubject,
  from,
  map,
  mergeMap,
  NEVER,
  Observable,
  observeOn,
  of,
  retry
} from "rxjs";
import * as readline from "readline";
import * as SocketImp from "./SocketImp";
import * as SocketIOImp from "./SocketIOImp";
import { log } from "./log";
import { SyncMessenger } from "../src";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string) {
  return new Observable<string>((o) => {
    rl.question(query, (ans) => {
      o.next(ans);
      o.complete();
    });
  });
}

// prettier-ignore
question("type: 1 ... net.Socket / 2 ... socket.io\n")
.pipe(mergeMap((ans) => {
  switch(ans){
    case "1": return of(new SocketImp.Client());
    case "2": return of(new SocketIOImp.Client());
  }
  throw Error("invalid type");
}))
.pipe(retry())
.pipe(map((client) => {
  return {
    client,
    messenger: SyncMessenger.clinentConnection({log}, client)
  };
}))
.pipe(mergeMap(({client, messenger}) => {
  messenger.onUnsolicitedMessage((data) => {
    log.info("onUnsolicitedMessage", data);
  });
  
  messenger.onSolcitedMessage((index, data) => {
    log.info("onSolcitedMessage", index, data);
    messenger.emitSolicitedResponse(index, data);
  });
  
  console.info(
    " 1/(message) : send solicited message\n" +
    " 2/(message) : send unsolicited message\n"+
    " 3/ : debug disconnect\n" +
    " others : goodbye\n"
  );

  const loop = new BehaviorSubject<void>(void 0);
  return loop
  .pipe(observeOn(asyncScheduler))
  .pipe(mergeMap(() => {
    return question("input > ");
  }))
  .pipe(mergeMap((command) => {
    const m = command.match(/^([123])\/(.*)$/);
    if(m){
      switch(m[1]){
        case "1": {
          return from(messenger.emitSolicitedMessageAndWaitResponse(m[2]))
          .pipe(map((resp) => {
            log.info("solicited response", resp);
          }));
        }
        case "2": {
          return from(messenger.emitUnsolicitedMessage(m[2]));
        }
        case "3": {
          client.debugDisconnect();
          return of(void 0);
        }
      }
    }
    messenger.goodbye();
    rl.close();
    loop.complete();
    return NEVER;
  }))
  .pipe(map(() => {
    loop.next(void 0);
  }))
}))
.subscribe();
