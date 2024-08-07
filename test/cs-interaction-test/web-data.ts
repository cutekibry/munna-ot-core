import { BasicOperation } from "../../lib/operation";

type WebDataAck = {
  type: "acknowledge";
  sessionId?: string;
}
type WebDataOperation = {
  type: "operation";
  operation: BasicOperation[];
  revision?: number;
  sessionId?: string;
}

/**
 * Promised type for the `event.data` sent between the server and the client.
 */
type WebData = WebDataAck | WebDataOperation;
export type { WebData, WebDataAck, WebDataOperation };