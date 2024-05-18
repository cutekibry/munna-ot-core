import * as _ from "lodash"
import { Operation } from "../operation"
import AbstractServerSocket from "../web-data-models/abstract-server-socket"

class Server<SocketT extends AbstractServerSocket> {
  doc: string;
  revision: number;
  operationHistory: Operation[];
  socket: SocketT;

  constructor(socket: SocketT) {
    this.doc = "";
    this.revision = 0;
    this.operationHistory = [];
    this.socket = socket;
    this.socket.register(this);
  }

  receiveOperation(operation: Operation, fromRevision: number, sessionId: string) {
    let newOp = _.clone(operation);

    // console.log("! receive", fromRevision, this.revision);

    _.range(fromRevision, this.revision).forEach(i => {
      newOp = Operation.transform(newOp, this.operationHistory[i])[0];
    });

    this.doc = newOp.apply(this.doc);
    this.operationHistory.push(newOp);
    this.revision++;
    this.socket.sendAck(sessionId);
    this.socket.sendOperationExcept(newOp, sessionId);
  }
}

export default Server;