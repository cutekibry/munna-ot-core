import * as assert from "assert";

import { ClientAwait, ClientBuffered, ClientContext } from "../src/client/client";
import { Operation } from "../src/operation";
import Server from "../src/server/server";
import AbstractClientSocket from "../src/web-data-models/abstract-client-socket";
import AbstractServerSocket from "../src/web-data-models/abstract-server-socket";
import { WebData, WebDataOperation } from "../src/web-data-models/web-data";
import * as _ from "lodash";


const ALICE = "alice";
const BOB = "bob";
const SERVER_ALICE = "server-alice";
const SERVER_BOB = "server-bob";

class TestServer extends Server<TestServerSocket> { }
class TestClient extends ClientContext<TestClientSocket> { }


class TestClientSocket implements AbstractClientSocket {
  client: TestClient = null;
  server: TestServer = null;
  sessionId: string = "";
  blockedWebDatas: WebDataOperation[] = [];

  sendOperation(operation: Operation, revision: number): void {
    this.blockedWebDatas.push({
      type: "operation",
      operation: operation.toZippedOperations(),
      revision: revision
    });
  }
  register(client: TestClient): void {
    this.client = client;
  }
}

class TestServerSocket implements AbstractServerSocket {
  clients: TestClient[] = [];
  server: TestServer = null;
  blockedWebDatas: WebData[] = [];

  sendAck(sessionId: string): void {
    this.blockedWebDatas.push({ type: "acknowledge", sessionId: sessionId });
  }
  sendOperationExcept(operation: Operation, sessionId: string): void {
    this.clients.forEach(client => {
      if (client.getSocket().sessionId !== sessionId)
        this.blockedWebDatas.push({
          type: "operation",
          operation: operation.toZippedOperations(),
          sessionId: client.getSocket().sessionId
        })
    })
  }
  register(server: TestServer): void {
    this.server = server;
  }
}

function sendBlockedWebData(source: TestClient | TestServer, targetSessionId?: string) {
  if (source instanceof TestClient) {
    const socket = source.getSocket();
    const firstData = socket.blockedWebDatas.shift();

    if (firstData === undefined)
      throw new Error(`No data for the given source ${source.getSocket().sessionId}`);

    console.log(`# Sending from ${source.getSocket().sessionId}`, firstData);

    socket.server.receiveOperation(Operation.fromZippedOperations(firstData.operation), firstData.revision, socket.sessionId);
  }

  else if (source instanceof TestServer) {
    const socket = source.socket;
    const firstData = socket.blockedWebDatas.filter(data => data.sessionId === targetSessionId)[0];

    if (firstData === undefined)
      throw new Error(`No data for the given sessionId ${targetSessionId}`);
    socket.blockedWebDatas = socket.blockedWebDatas.filter(data => data !== firstData);


    console.log("# Sending from server", firstData);

    if (firstData.type === "operation")
      socket.clients.forEach(client => {
        if (client.getSocket().sessionId === firstData.sessionId)
          client.applyServer(Operation.fromZippedOperations(firstData.operation));
      });
    else if (firstData.type === "acknowledge")
      socket.clients.forEach(client => {
        if (client.getSocket().sessionId === firstData.sessionId)
          client.ackOperation();
      });
  }
  else
    throw new TypeError("Invalid target");
}

class Insert {
  session: "alice" | "bob";
  pos: number;
  content: string;
  constructor(session: "alice" | "bob", pos: number, content: string) {
    this.session = session;
    this.pos = pos;
    this.content = content;
  }
  tf(doc: string) { return (new Operation()).addRetain(this.pos).addInsert(this.content).addRetain(doc.length - this.pos); }
}
class Delete {
  session: "alice" | "bob";
  pos: number;
  count: number;
  constructor(session: "alice" | "bob", pos: number, count: number) {
    this.session = session;
    this.pos = pos;
    this.count = count;
  }
  tf(doc: string) { return (new Operation()).addRetain(this.pos).addDelete(this.count).addRetain(Math.max(0, doc.length - this.pos - this.count)); }
}

class Send {
  session: "alice" | "bob" | "server-alice" | "server-bob";
  constructor(session: "alice" | "bob" | "server-alice" | "server-bob") {
    this.session = session;
  }
};

type Event = Insert | Delete | Send;


function link(client: TestClient, server: TestServer, sessionId: string) {
  if (client.client.socket instanceof TestClientSocket && server.socket instanceof TestServerSocket) {
    client.client.socket.server = server;
    client.client.socket.sessionId = sessionId;
    server.socket.clients.push(client);
  }
}

function testCSInteraction() {
  describe("client-server interaction", () => {
    function test(desc: string, events: Event[], expectedDoc?: string) {
      console.log(desc, events);
      describe(desc, () => {
        const server = new TestServer(new TestServerSocket());
        const alice = new TestClient(new TestClientSocket());
        const bob = new TestClient(new TestClientSocket());

        link(alice, server, ALICE);
        link(bob, server, BOB);

        events.forEach(event => {
          // console.log(event);
          if (event instanceof Insert || event instanceof Delete) {
            if (event.session === ALICE)
              alice.applyClient(event.tf(alice.client.doc.str));
            else if (event.session === BOB)
              bob.applyClient(event.tf(bob.client.doc.str));
          }
          else if (event instanceof Send) {
            switch (event.session) {
              case ALICE: {
                sendBlockedWebData(alice);
                break;
              }
              case BOB: {
                sendBlockedWebData(bob);
                break;
              }
              case SERVER_ALICE: {
                sendBlockedWebData(server, ALICE);
                break;
              }
              case SERVER_BOB: {
                sendBlockedWebData(server, BOB);
                break;
              }
            }
          }
        });

        it("all data are sent", () => {
          assert.strictEqual(alice.client.socket.blockedWebDatas.length, 0, `Test data left in alice's socket: ${JSON.stringify(alice.client.socket.blockedWebDatas)}`);
          assert.strictEqual(bob.client.socket.blockedWebDatas.length, 0, `Test data left in bob's socket: ${JSON.stringify(bob.client.socket.blockedWebDatas)}`);
          assert.strictEqual(server.socket.blockedWebDatas.length, 0, `Test data left in server's socket: ${JSON.stringify(server.socket.blockedWebDatas)}`);
        });

        it("all documents are synchronized", () => {
          assert.strictEqual(alice.client.doc.str, bob.client.doc.str, "alice and bob's documents are different");
          assert.strictEqual(alice.client.doc.str, server.doc, "alice and server's documents are different");
        });
        if (expectedDoc !== undefined)
          it("document's value is expected", () => {
            assert.strictEqual(alice.client.doc.str, expectedDoc, "final document is different from the expected document");
          });
      });
    }

    describe("alice only", () => {
      test("insert once", [
        new Insert(ALICE, 0, "01234"),
        new Send(ALICE),
        new Send(SERVER_ALICE),
        new Send(SERVER_BOB),
      ], "01234");

      test("insert once then delete once", [
        new Insert(ALICE, 0, "012345"),   // "012345"
        new Delete(ALICE, 2, 2),          // "01345"
        new Send(ALICE),
        new Send(SERVER_ALICE),
        new Send(SERVER_BOB),
        new Send(ALICE),
        new Send(SERVER_ALICE),
        new Send(SERVER_BOB),
      ], "0145");

      test("insert twice", [
        new Insert(ALICE, 0, "0123"),     // "0123"
        new Insert(ALICE, 2, "456"),      // "0145623"
        new Send(ALICE),
        new Send(SERVER_ALICE),
        new Send(ALICE),
        new Send(SERVER_ALICE),
        new Send(SERVER_BOB),
        new Send(SERVER_BOB),
      ], "0145623");

      describe("insert twice, delete once, insert once then delete once", () => {
        const events = [
          new Insert(ALICE, 0, "0123"),     // "0123"
          new Insert(ALICE, 2, "45"),       // "014523"
          new Delete(ALICE, 3, 3),          // "014"
          new Insert(ALICE, 3, "678"),      // "014678"
          new Delete(ALICE, 0, 1),          // "14678"
        ];

        test("sent after all operations are done in local", [
          events,
          _.times(2, () => [new Send(ALICE), new Send(SERVER_ALICE), new Send(SERVER_BOB)])
        ].flat(5), "14678");
        test("sent after each operation is done in local",
          events.map(event => [event, new Send(ALICE), new Send(SERVER_ALICE), new Send(SERVER_BOB)]).flat(5)
          , "14678");
        test("sent after 2 operations are done in local",
          _.chunk(events, 2).map(eventChunk =>
            [eventChunk, _.times(eventChunk.length, () => [new Send(ALICE), new Send(SERVER_ALICE), new Send(SERVER_BOB)])]
          ).flat(5)
          , "14678");
      });
    });
  });
}

export default testCSInteraction;