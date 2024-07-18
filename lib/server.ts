import _ from "lodash"
import { Operation } from "./operation"

abstract class Server {
  public operationHistory: Operation[] = [];
  public revision: number = 0;
  
  private doc: string = "";

  receiveOperation(operation: Operation, fromRevision: number, sessionId: string) {
    let newOp = _.clone(operation);

    _.range(fromRevision, this.revision).forEach(i => {
      newOp = Operation.transform(newOp, this.operationHistory[i])[0];
    });

    this.doc = newOp.apply(this.doc);
    this.operationHistory.push(newOp);
    this.revision++;
    this.sendAck(sessionId);
    this.sendOperationExcept(newOp, sessionId);
  }

  getDoc() { return this.doc; }

  /**
   * Should send an acknowledge message to the client with `sessionId`.
   * 
   * The sent data should be of type `WebDataAck`.
   * 
   * @param sessionId The session id of the client to send the acknowledge message to.
   * @return void
   */
  abstract sendAck(sessionId: string): this;

  /**
   * Should send `operation` to all clients except the one with `sessionId`.
   * 
   * The sent data should be of type `WebDataOperation`.
   * 
   * @param operation The operation to send.
   * @param sessionId The session id of the client to exclude.
   */
  abstract sendOperationExcept(operation: Operation, sessionId: string): this;
}

export default Server;