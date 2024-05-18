import { Operation } from "../operation"
import Server from "../server/server";

/**
 * Abstract interface for the `Server`'s socket.
 */
interface AbstractServerSocket {
  /**
   * Should send an acknowledge message to the client with `sessionId`.
   * 
   * The sent data should be of type `WebDataAck`.
   * 
   * @param sessionId The session id of the client to send the acknowledge message to.
   * @return void
   */
  sendAck(sessionId: string): void

  /**
   * Should send `operation` to all clients except the one with `sessionId`.
   * 
   * The sent data should be of type `WebDataOperation`.
   * 
   * @param operation The operation to send.
   * @param sessionId The session id of the client to exclude.
   */
  sendOperationExcept(operation: Operation, sessionId: string): void


  /**
   * Should register `websocket.onmessage`:
   * - to `server.receiveOperation(operation, fromRevision, sessionId)` if the data type is `WebDataOperation`.
   * 
   * @param server The server to register the socket to.
   */
  register(server: Server<any>): void
}

export default AbstractServerSocket;