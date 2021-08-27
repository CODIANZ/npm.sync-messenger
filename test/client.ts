import {
  BehaviorSubject,
  from,
  map,
  mergeMap,
  NEVER,
  of,
  retry,
  takeWhile
} from "rxjs";
import * as SocketImp from "./SocketImp";
import * as SocketIOImp from "./SocketIOImp";
import { log } from "./log";
import { SyncMessenger } from "../src";
import { closeQuestion, question } from "./question";

const loop = new BehaviorSubject(true);

// prettier-ignore
question("type: 1 ... net.Socket / 2 ... socket.io\n> ")
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
    if(data =="bals"){
      breakLoop();
    }
    log.info("onSolcitedMessage", index, data);
    messenger.emitSolicitedResponse(index, data)
    .then(() => {
      if(data == "bals"){
        messenger.goodbye();
      }
    });
  });
  
  // prettier-ignore
  console.info(
    "(message)  : send (message) as a solicited \n" +
    "-(message) : send (message) as an unsolicited message\n"+
    "/          : disconnect\n" +
    "bals       : finish messenger"
  );

  function breakLoop() {
    closeQuestion();
    setTimeout(() => {
      loop.next(false);
      loop.complete();
    });
  }  

  // prettier-ignore
  return loop.asObservable()
  .pipe(takeWhile(bContinue => bContinue))
  .pipe(mergeMap(() => {
    return question("> ");
  }))
  .pipe(mergeMap((command) => {
    if(command == "bals"){
      breakLoop();
      return from(messenger.emitSolicitedMessageAndWaitResponse("bals"))
      .pipe(map(() => {
        messenger.goodbye();
        return NEVER;
      }));
    }
    else if(command == "/"){
      client.debugDisconnect();
      return of(void 0);
    }
    else if(command.startsWith("-")){
      return from(messenger.emitUnsolicitedMessage(command.substr(1)))
      .pipe(map(() => {
        log.info("completed sending an unsolicited message");
      }));
    }
    else{
      return from(messenger.emitSolicitedMessageAndWaitResponse(command))
      .pipe(map((resp) => {
        log.info("solicited response", resp);
      }));
    }
  }))
}))
.subscribe({
  next: () => loop.next(true),
  complete: () =>  process.exit()
});
