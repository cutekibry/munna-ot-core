type ZippedBasicOperation = { retain: number } | { insert: string } | { delete: number };

/**
 * A simple JSON-format array to represent an `Operation`, in order to suit for network transfer.
 */
type ZippedOperations = ZippedBasicOperation[];

export { ZippedBasicOperation, ZippedOperations };