import { Client } from "../../lib/client";
import { Operation } from "../../lib/operation";
import { WebDataOperation } from "./web-data";
import TestServer from "./test-server";

class TestClient extends Client {
  sessionId: string = "";
  blockedWebDatas: WebDataOperation[] = [];
  server: TestServer;

  sendOperation(operation: Operation, revision: number): this {
    this.blockedWebDatas.push({
      type: "operation",
      operation: operation.operations,
      revision: revision
    });
    return this;
  }
}

export default TestClient;