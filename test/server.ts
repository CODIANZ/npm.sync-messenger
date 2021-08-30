import {
  asyncScheduler,
  BehaviorSubject,
  from,
  map,
  mergeMap,
  NEVER,
  observeOn,
  of,
  retry
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
  messenger.onUnsolicitedMessage((data) => {
    log.info("onUnsolicitedMessage", data);
  });

  messenger.onSolcitedMessage((index, data) => {
    log.info("onSolcitedMessage", index, data);
    messenger.emitSolicitedResponse(index, data).then(() => {
      if (data == "bals") {
        messenger.dispose();
        delete messengers[messenger.SessionId];
      }
    });
  });

  messengers[messenger.SessionId] = messenger;
}

// prettier-ignore
console.info(
  "(message)  : send (message) as a solicited \n" +
  "-(message) : send (message) as an unsolicited message\n" +
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
      messenger.emitSolicitedMessageAndWaitResponse("bals")
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
      messenger.emitUnsolicitedMessage(command.substr(1));
    });
  }
  else{
    Object.keys(messengers)
    .map(idx => messengers[idx])
    .map((messenger) => {
      messenger.emitSolicitedMessageAndWaitResponse(command)
      .then(() => {

      });
    });
  }
}))
.pipe(map(() => {
  loop.next(void 0);
}))
.subscribe();
