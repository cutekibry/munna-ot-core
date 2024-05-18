import { Operation } from "../operation";
import { abstract } from "../utils/decorators";
import AbstractClientSocket from "../web-data-models/abstract-client-socket";


class RefString {
  str: string;
  constructor(str: string) {
    this.str = str;
  }
}


/**
 * Base class for a Client's certain status.
 * 
 * This is a inner class. Use `ClientContext` instead.
 */
class ClientBase<SocketT extends AbstractClientSocket> {
  revision: number = 0;
  doc: RefString = new RefString("");
  awaitOperation: Operation = null;
  bufferedOperation: Operation = null;
  socket: SocketT = null;

  constructor(client?: ClientBase<SocketT>) {
    if (client instanceof ClientBase) {
      this.revision = client.revision;
      this.doc = client.doc;
      this.awaitOperation = client.awaitOperation;
      this.bufferedOperation = client.bufferedOperation;
      this.socket = client.socket;
    }
  }

  // Apply a local operation to the client's document and send it to the server.
  @abstract applyClient(operation: Operation): ClientBase<SocketT> { return this; }

  // Apply a remote operation to the client's document.
  // Should increase revision by 1.
  @abstract applyServer(operation: Operation): ClientBase<SocketT> { return this; }

  // Acknowledge the operation that the client last sent to the server.
  // Should NOT change revision.
  // Should NOT change the document.
  @abstract ackOperation(): ClientBase<SocketT> { return this; }

  // Apply an operation directly to the client's document.
  // Will NOT change revision or send the operation to the server.
  applyOperation(operation: Operation) {
    this.doc.str = operation.apply(this.doc.str);
    return this;
  }

  // Send an operation and revision no. to the server.
  sendOperation(operation: Operation, revision: number) {
    this.socket.sendOperation(operation, revision);
    return this;
  }
}

class ClientSync<SocketT extends AbstractClientSocket> extends ClientBase<SocketT> {
  applyClient(operation: Operation): ClientAwait<SocketT> {
    this.applyOperation(operation);
    
    this.awaitOperation = operation;
    this.revision++;
    this.sendOperation(this.awaitOperation, this.revision - 1);

    return new ClientAwait(this);
  }
  applyServer(operation: Operation) {
    this.applyOperation(operation);
    this.revision++;
    return this;
  }
  ackOperation() {
    throw new Error("ackOperation on ClientSync is invalid");
    return this;
  }
}

class ClientAwait<SocketT extends AbstractClientSocket> extends ClientBase<SocketT> {
  applyClient(operation: Operation): ClientBuffered<SocketT> {
    this.applyOperation(operation);

    this.bufferedOperation = operation;
    this.revision++;

    return new ClientBuffered(this);
  }
  applyServer(operation: Operation) {
    const [operationPrime, _] = Operation.transform(operation, this.awaitOperation);
    this.applyOperation(operationPrime);
    this.revision++;
    return this;
  }
  ackOperation(): ClientSync<SocketT> {
    this.awaitOperation = null;
    return new ClientSync(this);
  }
}
class ClientBuffered<SocketT extends AbstractClientSocket> extends ClientBase<SocketT> {
  applyClient(operation: Operation): ClientBase<SocketT> {
    this.applyOperation(operation);

    this.bufferedOperation = Operation.compose(this.bufferedOperation, operation);

    // Since we are buffering, we don't need to change the revision.
    // this.revision++;
    
    return new ClientBuffered(this);
  }
  applyServer(operation: Operation): ClientBase<SocketT> {
    const [operationPrime1, awaitOperationPrime] = Operation.transform(operation, this.awaitOperation);
    const [operationPrime2, bufferedOperationPrime] = Operation.transform(operationPrime1, this.bufferedOperation);

    this.applyOperation(operationPrime2);
    [this.awaitOperation, this.bufferedOperation] = [awaitOperationPrime, bufferedOperationPrime];

    this.revision++;
    return this;
  }
  ackOperation(): ClientBase<SocketT> {
    [this.awaitOperation, this.bufferedOperation] = [this.bufferedOperation, null];

    this.sendOperation(this.awaitOperation, this.revision - 1);

    return new ClientAwait(this);
  }
}

class ClientContext<SocketT extends AbstractClientSocket> {
  client: ClientBase<SocketT>;

  constructor(socket: SocketT) {
    this.client = new ClientSync();
    this.client.revision = 0;
    this.client.socket = socket;
    socket.register(this);
  }

  getRevision() { return this.client.revision; }
  getDoc() { return this.client.doc.str; }
  getSocket() { return this.client.socket; }

  applyServer(operation: Operation) { this.client = this.client.applyServer(operation); }
  applyClient(operation: Operation) { this.client = this.client.applyClient(operation); }
  ackOperation() { this.client = this.client.ackOperation(); }
  applyOperation(operation: Operation) { this.client = this.client.applyOperation(operation); }
  sendOperation(operation: Operation, revision: number) { this.client = this.client.sendOperation(operation, revision); }
}

export { ClientContext, ClientSync, ClientAwait, ClientBuffered };