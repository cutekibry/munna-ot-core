import { ZippedOperations } from "./zipped-operations";

type WebDataAck = {
  type: "acknowledge";
  sessionId?: string;
}
type WebDataOperation = {
  type: "operation";
  operation: ZippedOperations;
  revision?: number;
  sessionId?: string;
}

/**
 * Promised type for the `event.data` sent between the server and the client.
 */
type WebData = WebDataAck | WebDataOperation;
export { WebData, WebDataAck, WebDataOperation };