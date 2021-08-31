import {
  asyncScheduler,
  BehaviorSubject,
  map,
  mergeMap,
  observeOn
} from "rxjs";
import * as SocketImp from "./SocketImp";
import * as SocketIOImp from "./SocketIOImp";
import { log } from "./log";
import { question } from "./question";
import { SyncMessenger } from "../src/";

const messengers: { [id: string]: SyncMessenger } = {};

SyncMessenger.serverConnection({ log }, new SocketImp.Server(), (msgr) => {
  addMessenger(msgr);
});

SyncMessenger.serverConnection({ log }, new SocketIOImp.Server(), (msgr) => {
  addMessenger(msgr);
});

function addMessenger(messenger: SyncMessenger) {
  messenger.onNotice((noticeBody) => {
    log.info("onNotice", noticeBody);
  });

  messenger.onRequest((requestBody, responseEmitter) => {
    log.info("onRequest", requestBody);
    responseEmitter(`receipt -> ${requestBody}`).then(() => {
      if (requestBody == "bals") {
        messenger.dispose();
        delete messengers[messenger.SessionId];
      }
    });
  });

  messengers[messenger.SessionId] = messenger;
}

// prettier-ignore
console.info(
  "(message)  : send request \n" +
  "-(message) : send notice\n" +
  "bals       : finish messenger"
);

const loop = new BehaviorSubject<void>(void 0);

// prettier-ignore
loop.asObservable()
.pipe(observeOn(asyncScheduler))
.pipe(mergeMap(() => {
  return question("> ");
}))
.pipe(map((command) => {
  if(command == "bals"){
    Object.keys(messengers)
    .map(idx => messengers[idx])
    .map((messenger) => {
      messenger.emitRequest("bals")
      .then(() => {
        messenger.dispose();
        delete messengers[messenger.SessionId];
      })
    })
  }
  else if(command.startsWith("-")){
    Object.keys(messengers)
    .map(idx => messengers[idx])
    .map((messenger) => {
      messenger.emitNotice(command.substr(1));
    });
  }
  else{
    Object.keys(messengers)
    .map(idx => messengers[idx])
    .map((messenger) => {
      messenger.emitRequest(command)
      .then(() => {
      });
    });
  }
}))
.pipe(map(() => {
  loop.next(void 0);
}))
.subscribe();
