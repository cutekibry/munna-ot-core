import { Operation } from "../../lib/operation";
import Server from "../../lib/server";
import { WebData } from "./web-data";
import TestClient from "./test-client";

class TestServer extends Server {
  clients: TestClient[] = [];
  blockedWebDatas: WebData[] = [];

  sendAck(sessionId: string): this {
    this.blockedWebDatas.push({ type: "acknowledge", sessionId: sessionId });
    return this;
  }
  sendOperationExcept(operation: Operation, sessionId: string): this {
    this.clients.forEach(client => {
      if (client.sessionId !== sessionId)
        this.blockedWebDatas.push({
          type: "operation",
          operation: operation.operations,
          sessionId: client.sessionId
        })
    });
    return this;
  }
}

export default TestServer;