import _ from "lodash";
import { Operation } from "./operation";

/**
 * Represents a server that can connect with multiple clients.
 */
abstract class Server {
  /**
   * The history of operations performed on the server.
   */
  public operationHistory: Operation[] = [];

  /**
   * The current revision number of the server.
   */
  public revision: number = 0;

  /**
   * The document content on the server.
   */
  private doc: string = "";

  /**
   * Receives an operation from a client and applies it to the server's document.
   * 
   * (Usually) should NOT manually called.
   * @param operation The operation to be applied.
   * @param fromRevision The revision number from which the operation is received.
   * @param sessionId The session ID of the client sending the operation.
   */
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

  /**
   * Gets the current document on the server.
   * 
   * @returns The document content.
   */
  getDoc() { return this.doc; }

  /**
   * Sends an acknowledge message to a client with the specified session ID.
   * 
   * (Usually) should NOT manually called.
   * @param sessionId The session ID of the client to send the acknowledge message to.
   * @returns The current instance of the Server class.
   */
  abstract sendAck(sessionId: string): this;

  /**
   * Sends an operation to all clients except the one with the specified session ID.
   * 
   * (Usually) should NOT manually called.
   * @param operation The operation to send.
   * @param sessionId The session ID of the client to exclude.
   * @returns The current instance of the Server class.
   */
  abstract sendOperationExcept(operation: Operation, sessionId: string): this;
}

export default Server;