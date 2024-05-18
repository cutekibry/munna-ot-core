import { Operation } from "../operation";
import { ClientContext } from "../client/client";

/**
 * Abstract interface for the `ClientSocket`'s socket.
 */
interface AbstractClientSocket {
  /**
   * Should send `WebDataOperation` with `operation` and `revision` to the server.
   * 
   * @param operation The operation to send.
   * @param revision The revision number of the operation.
   * 
   * @return void
   */
  sendOperation(operation: Operation, revision: number): void;

  /** 
   * Should register `websocket.onmessage` to:
   * - `client.ackOperation()` if the `event.data` is `WebDataAck`.
   * - `client.applyServer(event.data.operation)` if the `event.data` is `WebDataOperation`.
   * 
   * @param client The client to register the socket to.
  */
  register(client: ClientContext<any>): void;
}

export default AbstractClientSocket;