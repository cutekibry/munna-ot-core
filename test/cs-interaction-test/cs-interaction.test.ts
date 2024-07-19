import _ from "lodash";
import { describe, it, expect } from "vitest";

import { Operation } from "../../lib/operation";
import TestClient from "./test-client";
import TestServer from "./test-server";


const ALICE = "alice";
const BOB = "bob";
const SERVER_ALICE = "server-alice";
const SERVER_BOB = "server-bob";



function sendBlockedWebData(source: TestClient | TestServer, targetSessionId?: string) {
  if (source instanceof TestClient) {
    const firstData = source.blockedWebDatas.shift();

    if (firstData === undefined)
      throw new Error(`No data for the given source ${source.sessionId}`);

    // console.log(`# Sending from ${source.sessionId}`, firstData);

    source.server.receiveOperation(Operation.fromBasicOperations(firstData.operation), firstData.revision!, source.sessionId);
  }

  else if (source instanceof TestServer) {
    const firstData = source.blockedWebDatas.filter(data => data.sessionId === targetSessionId)[0];
    const targetClient = source.clients.filter(client => client.sessionId === targetSessionId)[0];

    if (firstData === undefined)
      throw new Error(`No data for the given sessionId ${targetSessionId}`);
    else if (targetClient === undefined)
      throw new Error(`No client for the given sessionId ${targetSessionId}`);

    source.blockedWebDatas = source.blockedWebDatas.filter(data => data !== firstData);

    // console.log("# Sending from server", firstData);

    if (firstData.type === "operation")
      targetClient.applyServer(Operation.fromBasicOperations(firstData.operation));
    else if (firstData.type === "acknowledge")
      targetClient.ackOperation();
  }
  else
    throw new TypeError("Invalid target");
}

class Insert {
  constructor(
    public session: "alice" | "bob",
    public pos: number,
    public content: string
  ) { }
  tf(doc: string) { return (new Operation()).addRetain(this.pos).addInsert(this.content).addRetain(doc.length - this.pos); }
}
class Delete {
  constructor(
    public session: "alice" | "bob",
    public pos: number,
    public count: number
  ) { }
  tf(doc: string) { return (new Operation()).addRetain(this.pos).addDelete(this.count).addRetain(Math.max(0, doc.length - this.pos - this.count)); }
}

class Send {
  constructor(public session: "alice" | "bob" | "server-alice" | "server-bob") { }
};

type Event = Insert | Delete | Send;


function link(client: TestClient, server: TestServer, sessionId: string) {
  client.server = server;
  client.sessionId = sessionId;
  server.clients.push(client);
}

describe("client-server interaction", () => {
  function test(desc: string, events: Event[], expectedDoc?: string | string[]) {
    // console.log(desc, events);
    describe(desc, () => {
      const server = new TestServer();
      const alice = new TestClient();
      const bob = new TestClient();

      link(alice, server, ALICE);
      link(bob, server, BOB);

      events.forEach(event => {
        // console.log(event);
        if (event instanceof Insert || event instanceof Delete) {
          if (event.session === ALICE)
            alice.applyClient(event.tf(alice.getDoc()));
          else if (event.session === BOB)
            bob.applyClient(event.tf(bob.getDoc()));
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
        expect(alice.blockedWebDatas.length).toBe(0);
        expect(bob.blockedWebDatas.length).toBe(0);
        expect(server.blockedWebDatas.length).toBe(0);
      });

      it("all documents are synchronized", () => {
        expect(alice.getDoc()).toBe(bob.getDoc());
        expect(alice.getDoc()).toBe(server.getDoc());
      });
      if (expectedDoc !== undefined)
        it("document's value is expectedly correct", () => {
          if (typeof expectedDoc === "string")
            // final document should be equal to the expected document
            expect(alice.getDoc()).toBe(expectedDoc);
          else
            // final document should be in any acceptable documents
            expect(expectedDoc).toContain(alice.getDoc());
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
  describe("both clients", () => {
    test("alice inserts once, bob inserts once", [
      new Insert(ALICE, 0, "0123"),
      new Insert(BOB, 0, "4567"),
      new Send(ALICE),
      new Send(BOB),
      new Send(SERVER_ALICE),
      new Send(SERVER_BOB),
      new Send(SERVER_ALICE),
      new Send(SERVER_BOB),
    ], ["01234567", "45670123"]);
    test("on a base document, alice inserts twice, bob inserts once, alice sent after bob sent", [
      new Insert(ALICE, 0, "0123"),
      new Send(ALICE),
      new Send(SERVER_ALICE),
      new Send(SERVER_BOB),

      new Insert(ALICE, 3, "456"),  // 0124563
      new Delete(ALICE, 2, 3),      // 0163
      new Delete(BOB, 1, 3),        // 0
      new Send(BOB),
      new Send(ALICE),
      new Send(SERVER_ALICE),
      new Send(SERVER_ALICE),
      new Send(SERVER_BOB),
      new Send(ALICE),
      new Send(SERVER_BOB),
      new Send(SERVER_ALICE),
      new Send(SERVER_BOB),
    ], "06");
  });
});