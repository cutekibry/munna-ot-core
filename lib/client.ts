import { Operation } from "./operation";


/**
 * Represents the state of a client in the text editor.
 */
interface ClientState {
  /**
   * Apply a local operation to the client's document and send it to the server.
   * 
   * Called when the client performs an operation.
   * @param context The client context.
   * @param operation The operation to apply.
   * @returns The updated client state.
   */
  applyClient(context: Client, operation: Operation): ClientState

  /**
   * Apply a remote operation from server to the client's document.
   * 
   * Called when the client receives an operation from the server.
   * @param context The client context.
   * @param operation The operation to apply.
   * @returns The updated client state.
   */
  applyServer(context: Client, operation: Operation): ClientState

  /**
   * Acknowledge the latest unacknowledged operation.
   * 
   * Called when the client receives an acknowledgement from the server.
   * @param context The client context.
   * @returns The updated client state.
   */
  ackOperation(context: Client): ClientState
}


class ClientStateSync implements ClientState {
  applyClient(context: Client, operation: Operation): ClientStateAwait {
    context.applyOperation(operation);

    context.awaitOperation = operation;
    context.revision++;
    context.sendOperation(context.awaitOperation, context.revision - 1);

    return new ClientStateAwait();
  }
  applyServer(context: Client, operation: Operation) {
    context.applyOperation(operation);
    context.revision++;
    return this;
  }
  ackOperation() {
    throw new Error("ackOperation on ClientSync is invalid");
    return this;
  }
}

class ClientStateAwait implements ClientState {
  applyClient(context: Client, operation: Operation): ClientStateBuffered {
    context.applyOperation(operation);

    context.bufferedOperation = operation;
    context.revision++;

    return new ClientStateBuffered();
  }
  applyServer(context: Client, operation: Operation) {
    const [operationPrime, __] = Operation.transform(operation, context.awaitOperation!);
    context.applyOperation(operationPrime);
    context.revision++;
    return this;
  }
  ackOperation(context: Client): ClientStateSync {
    context.awaitOperation = null;
    return new ClientStateSync();
  }
}
class ClientStateBuffered implements ClientState {
  applyClient(context: Client, operation: Operation) {
    context.applyOperation(operation);

    context.bufferedOperation = Operation.compose(context.bufferedOperation!, operation);

    // Since we are buffering, we don't need to change the revision.
    // this.revision++;

    return new ClientStateBuffered();
  }
  applyServer(context: Client, operation: Operation) {
    const [operationPrime1, awaitOperationPrime] = Operation.transform(operation, context.awaitOperation!);
    const [operationPrime2, bufferedOperationPrime] = Operation.transform(operationPrime1, context.bufferedOperation!);

    context.applyOperation(operationPrime2);
    [context.awaitOperation, context.bufferedOperation] = [awaitOperationPrime, bufferedOperationPrime];

    context.revision++;
    return this;
  }
  ackOperation(context: Client) {
    [context.awaitOperation, context.bufferedOperation] = [context.bufferedOperation, null];

    context.sendOperation(context.awaitOperation!, context.revision - 1);

    return new ClientStateAwait();
  }
}


/**
 * Represents a client in the text editor.
 */
abstract class Client {
  /**
   * The current revision number of the client.
   */
  public revision: number = 0;

  /**
   * The operation that the client is waiting for acknowledgement from the server.
   */
  public awaitOperation: Operation | null = null;
  
  /**
   * The operation that is currently buffered by the client.
   */
  public bufferedOperation: Operation | null = null;

  /**
   * The current state of the client.
   */
  public state: ClientState = new ClientStateSync();

  /**
   * The current content of document.
   */
  private doc: string = "";

  /**
   * Apply a remote operation from server to the client's document.
   * 
   * Called when the client receives an operation from the server
   * 
   * (Usually) should NOT manually called.
   * @param operation The operation to apply.
   */
  applyServer(operation: Operation) { this.state = this.state.applyServer(this, operation); }

  /**
   * Apply a local operation to the client's document and send it to the server.
   * 
   * Call this function when the client needs to perform an operation.
   * @param operation The operation to apply.
   */
  applyClient(operation: Operation) { this.state = this.state.applyClient(this, operation); }

  /**
   * Acknowledge the latest unacknowledged operation.
   * 
   * Called when the client receives an acknowledgement from the server.
   * 
   * (Usually) should NOT manually called.
   */
  ackOperation() { this.state = this.state.ackOperation(this); }

  /**
   * Get the current document content.
   * 
   * @returns The document content.
   */
  getDoc() { return this.doc; }

  /**
   * Apply an operation to the document.
   * 
   * Will only update the document and NOT handle the revision, server
   * and so on.
   * 
   * (Usually) should NOT manually called. Consider using `Client.applyClient`.
   * 
   * @param operation - The operation to apply.
   */
  applyOperation(operation: Operation) { this.doc = operation.apply(this.doc); }

  /**
   * Send an operation to the server.
   * 
   * (Usually) should NOT manually called.
   * 
   * @param operation - The operation to send.
   * @param revision - The current revision number (= this.revision).
   * @returns The updated client instance.
   */
  abstract sendOperation(operation: Operation, revision: number): this
}

export { Client, ClientStateSync, ClientStateAwait, ClientStateBuffered };
export type { ClientState };