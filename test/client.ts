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
  messenger.onNotice((noticeBody) => {
    log.info("onNotice", noticeBody);
  });
  
  messenger.onRequest((requestBody, responseEmitter) => {
    if(requestBody =="bals"){
      breakLoop();
    }
    log.info("onRequest", requestBody);
    responseEmitter(`receipt -> ${requestBody}`)
    .then(() => {
      if(requestBody == "bals"){
        messenger.dispose();
      }
    });
  });
  
  // prettier-ignore
  console.info(
    "(message)  : send request \n" +
    "-(message) : send notice\n"+
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
      return from(messenger.emitRequest("bals"))
      .pipe(map(() => {
        messenger.dispose();
        return NEVER;
      }));
    }
    else if(command == "/"){
      client.debugDisconnect();
      return of(void 0);
    }
    else if(command.startsWith("-")){
      return from(messenger.emitNotice(command.substr(1)))
      .pipe(map(() => {
        log.info("completed sending a request");
      }));
    }
    else{
      return from(messenger.emitRequest(command))
      .pipe(map((responseBody) => {
        log.info("received response", responseBody);
      }));
    }
  }))
}))
.subscribe({
  next: () => loop.next(true),
  complete: () =>  process.exit()
});
