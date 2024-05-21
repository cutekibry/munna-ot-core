import { Operation } from "../operation";


interface ClientState {
  // Apply a local operation to the client's document and send it to the server.
  applyClient(context: Client, operation: Operation): ClientState

  // Apply a remote operation to the client's document.
  applyServer(context: Client, operation: Operation): ClientState
  
  // Acknowledge the operation that the client last sent to the server.
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
  ackOperation(context: Client) {
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
    const [operationPrime, _] = Operation.transform(operation, context.awaitOperation);
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

    context.bufferedOperation = Operation.compose(context.bufferedOperation, operation);

    // Since we are buffering, we don't need to change the revision.
    // this.revision++;

    return new ClientStateBuffered();
  }
  applyServer(context: Client, operation: Operation) {
    const [operationPrime1, awaitOperationPrime] = Operation.transform(operation, context.awaitOperation);
    const [operationPrime2, bufferedOperationPrime] = Operation.transform(operationPrime1, context.bufferedOperation);

    context.applyOperation(operationPrime2);
    [context.awaitOperation, context.bufferedOperation] = [awaitOperationPrime, bufferedOperationPrime];

    context.revision++;
    return this;
  }
  ackOperation(context: Client) {
    [context.awaitOperation, context.bufferedOperation] = [context.bufferedOperation, null];

    context.sendOperation(context.awaitOperation, context.revision - 1);

    return new ClientStateAwait();
  }
}

abstract class Client {
  public revision: number = 0;
  public awaitOperation: Operation = null;
  public bufferedOperation: Operation = null;
  public state: ClientState = new ClientStateSync();

  private doc: string = "";

  applyServer(operation: Operation) { this.state = this.state.applyServer(this, operation); }
  applyClient(operation: Operation) { this.state = this.state.applyClient(this, operation); }
  ackOperation() { this.state = this.state.ackOperation(this); }

  getDoc() { return this.doc; }

  applyOperation(operation: Operation) { this.doc = operation.apply(this.doc); }
  abstract sendOperation(operation: Operation, revision: number): this
}

export { Client, ClientStateSync, ClientStateAwait, ClientStateBuffered, ClientState };