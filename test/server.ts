import * as SocketImp from "./SocketImp";
import * as SocketIOImp from "./SocketIOImp";
import { log } from "./log";
import { SyncMessenger } from "../src/";

SyncMessenger.serverConnection({ log }, new SocketImp.Server(), (messenger) => {
  messenger.onUnsolicitedMessage((data) => {
    log.info("onUnsolicitedMessage", data);
  });

  messenger.onSolcitedMessage((index, data) => {
    log.info("onSolcitedMessage", index, data);
    messenger.emitSolicitedResponse(index, data);
  });
});

SyncMessenger.serverConnection(
  { log },
  new SocketIOImp.Server(),
  (messenger) => {
    messenger.onUnsolicitedMessage((data) => {
      log.info("onUnsolicitedMessage", data);
    });

    messenger.onSolcitedMessage((index, data) => {
      log.info("onSolcitedMessage", index, data);
      messenger.emitSolicitedResponse(index, data);
    });
  }
);
