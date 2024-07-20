import _ from "lodash";

/**
 * Represents a basic operation in the operational transformation.
 */
type BasicOperation = { retain: number } | { insert: string } | { delete: number };

/**
 * Checks if the given operation is a retain operation.
 * @param op The operation to check.
 * @returns True if the operation is a retain operation, false otherwise.
 */
function isRetain(op: BasicOperation): op is { retain: number } {
  return op != null && op.hasOwnProperty("retain");
}

/**
 * Checks if the given operation is an insert operation.
 * @param op The operation to check.
 * @returns True if the operation is an insert operation, false otherwise.
 */
function isInsert(op: BasicOperation): op is { insert: string } {
  return op != null && op.hasOwnProperty("insert");
}

/**
 * Checks if the given operation is a delete operation.
 * @param op The operation to check.
 * @returns True if the operation is a delete operation, false otherwise.
 */
function isDelete(op: BasicOperation): op is { delete: number } {
  return op != null && op.hasOwnProperty("delete");
}

/**
 * Checks if the given basic operation is empty.
 * @param op The basic operation to check.
 * @returns True if the operation is empty, false otherwise.
 * @throws {TypeError} If the operation is of unknown type.
 */
function isEmptyBasicOp(op: BasicOperation): boolean {
  if (isRetain(op))
    return op.retain === 0;
  else if (isInsert(op))
    return op.insert === "";
  else if (isDelete(op))
    return op.delete === 0;
  else
    throw new TypeError("Unknown type error");
}

/**
 * Represents an operation in the operational transformation.
 */
class Operation {
  /**
   * Array of basic operations.
   */
  operations: BasicOperation[] = [];

  /**
   * The expected length of the document before applied.
   */
  baseLength: number = 0;

  /**
   * The expected length of the document after applied.
   */
  targetLength: number = 0;

  /**
   * Adds a retain operation to the operation.
   * @param n The number of characters to retain.
   * @returns The updated operation.
   */
  addRetain(n: number): this {
    if (n === 0)
      return this;
    this.baseLength += n;
    this.targetLength += n;

    const back = this.operations[this.operations.length - 1];
    if (isRetain(back))
      back.retain += n;
    else
      this.operations.push({ retain: n });
    return this;
  }

  /**
   * Adds an insert operation to the operation.
   * @param str The string to insert.
   * @returns The updated operation.
   */
  addInsert(str: string): this {
    if (str === "")
      return this;
    this.targetLength += str.length;

    const back = this.operations[this.operations.length - 1];
    if (isInsert(back))
      back.insert += str;
    else
      this.operations.push({ insert: str });
    return this;
  }

  /**
   * Adds a delete operation to the operation.
   * @param n The number of characters to delete.
   * @returns The updated operation.
   */
  addDelete(n: number): this {
    if (n === 0)
      return this;

    this.baseLength += n;

    const back = this.operations[this.operations.length - 1];
    if (isDelete(back))
      back.delete += n;
    else
      this.operations.push({ delete: n });
    return this;
  }

  /**
   * Applies the operation to a document.
   * @param doc The document to apply the operation to.
   * @returns The modified document.
   * @throws {Error} If the operation's base length is not equal to the document's length.
   * @throws {Error} If the operation's target length is not equal to the document's length.
   */
  apply(doc: string): string {
    if (doc.length !== this.baseLength)
      throw new Error("The operation's base length must be equal to the document's length.");

    const resStr: string[] = [];
    let ind = 0;

    this.operations.forEach(op => {
      if (isRetain(op)) {
        if (ind + op.retain > doc.length)
          throw new Error("The string is too short.");
        resStr.push(doc.slice(ind, ind + op.retain));
        ind += op.retain;
      }
      else if (isInsert(op))
        resStr.push(op.insert);
      else if (isDelete(op))
        ind += op.delete;
    })

    if (ind !== doc.length)
      throw new Error("The operation's target length must be equal to the document's length.");

    return resStr.join("");
  }

  /**
   * Returns the inverse of `this` that `apply(apply(doc, this), inverse) === doc`.
   * Note that the argument `doc` should be original doc, not the result of apply(doc, this).
   * 
   * @param doc The original document.
   * @returns The inverse of `this`.
   */
  invert(doc: string): Operation {
    const inverse = new Operation();
    let ind = 0;

    this.operations.forEach(op => {
      if (isRetain(op)) {
        inverse.addRetain(op.retain);
        ind += op.retain;
      }
      else if (isInsert(op))
        inverse.addDelete(op.insert.length);
      else if (isDelete(op)) {
        inverse.addInsert(doc.slice(ind, ind + op.delete));
        ind += op.delete;
      }
    })
    return inverse;
  }

  /**
   * Returns a merged `Operation` equal to `a + b`. Formally, `apply(apply(doc, a), b) = apply(doc, compose(a, b))`.
   * 
   * `a` and `b` should be sequential operations, not concurrent. 
   * 
   * @param a The first `Operation`.
   * @param b The second `Operation`.
   * @returns The merged `Operation`.
   */
  static compose(a: Operation, b: Operation): Operation {
    // We can use a two-pointer approach to merge the two operations in O(n) time and space,
    // where n = max(a.operations.length, b.operations.length).
    //
    // It's worth noting that this function is recursive.
    // After merging the first two operations in a and b, we can move to the rest of the operations
    // without caring about the operations we've merged.
    // i.e. we can always assume that aOp and bOp are the first operations in doc.
    // Therefore, we can consider a to get the first several letters in apply(doc, a),
    // then consider that how b will change the result of those letters.

    const resArray = new Operation();

    if (a.targetLength !== b.baseLength)
      throw new Error("The base length of the second operation should be the target length of the first operation.");

    // Clone the first operation in a and b.
    // Note that we might change the count or content of the operation,
    // so to keep the arguments unchanged we need to clone them.
    let aOp = _.cloneDeep(a.operations[0]), bOp = _.cloneDeep(b.operations[0]);
    let aInd = 1, bInd = 1;
    while (aOp !== undefined || bOp !== undefined) {
      // If aOp is Delete then we can just add it to the result,
      // since the part we deleted in the beginning has no effect to b.
      if (isDelete(aOp)) {
        resArray.addDelete(aOp.delete);
        aOp.delete = 0;
      }

      // Below this line we can assume that aOp is Retain or Insert.
      // In this case, if bOp is Insert, we can just add it to the result
      // for the same reason as above.
      else if (isInsert(bOp)) {
        resArray.addInsert(bOp.insert);
        bOp.insert = "";
      }

      else if (aOp === undefined || bOp === undefined)
        throw new Error("Infinite loop error");

      // Below this line we can assume that bOp is Retain or Delete.
      else if (isRetain(aOp) && isRetain(bOp)) {
        // Case 1: both are Retain
        // We can retain the min(aOp.count, bOp.count) characters in document and recursive.
        const minCount = Math.min(aOp.retain, bOp.retain);
        resArray.addRetain(minCount);
        aOp.retain -= minCount;
        bOp.retain -= minCount;
      }
      else if (isRetain(aOp) && isDelete(bOp)) {
        // Case 2: aOp is Retain and bOp is Delete
        // We can delete the min(aOp.count, bOp.count) characters in document and recursive.
        const minCount = Math.min(aOp.retain, bOp.delete);
        resArray.addDelete(minCount);
        aOp.retain -= minCount;
        bOp.delete -= minCount;
      }
      else if (isInsert(aOp) && isRetain(bOp)) {
        // Case 3: aOp is Insert and bOp is Retain
        // We can insert the min(aOp.content.length, bOp.count) characters into document and recursive.
        const minCount = Math.min(aOp.insert.length, bOp.retain);
        resArray.addInsert(aOp.insert.slice(0, minCount));
        aOp.insert = aOp.insert.slice(minCount);
        bOp.retain -= minCount;
      }
      else if (isInsert(aOp) && isDelete(bOp)) {
        // Case 4: aOp is Insert and bOp is Delete
        // We can delete the first min(aOp.content.length, bOp.count) characters in aOp.content and recursive.
        const minCount = Math.min(aOp.insert.length, bOp.delete);
        aOp.insert = aOp.insert.slice(minCount);
        bOp.delete -= minCount;
      }

      if (aOp !== undefined && isEmptyBasicOp(aOp)) {
        aOp = _.cloneDeep(a.operations[aInd]);
        aInd++;
      }
      if (bOp !== undefined && isEmptyBasicOp(bOp)) {
        bOp = _.cloneDeep(b.operations[bInd]);
        bInd++;
      }
    }

    return resArray;
  }

  /**
   * Takes two operations `a` and `b` that happened concurrently and
   * produces two operations `a'` and `b'` such that
   * `apply(apply(doc, a), b') = apply(apply(doc, b), a')`.
   * 
   * `a` and `b` should be concurrent operations, not sequential.
   * 
   * This function is commutative, i.e. `transform(a, b) === transform(b, a).reverse()`.
   * 
   * @param a One of the operations.
   * @param b The other operation.
   * @returns The transformed operations `[a', b']`.
   */
  static transform(a: Operation, b: Operation): [Operation, Operation] {
    // This function is also recursive.
    // We only need to keep the imaginary cursors in a and b at the same position,
    // then we can always assume that aOp and bOp are the first operations in doc.
    if (a.baseLength !== b.baseLength)
      throw new Error("Both operations should have the same base length.");

    const aPrime = new Operation(), bPrime = new Operation();

    let aOp = _.cloneDeep(a.operations[0]), bOp = _.cloneDeep(b.operations[0]);
    let aInd = 1, bInd = 1;
    while (aOp !== undefined || bOp !== undefined) {
      if (isInsert(aOp) && isInsert(bOp)) {
        // If both are Insert, we can just move them to the result.
        // To ensure transform(a, b) and transform(b, a) return the same a' and b',
        // we need to have a strict order of aOp and bOp.
        // We can simply compare the content.
        if (aOp.insert < bOp.insert) {
          aPrime.addInsert(aOp.insert);
          bPrime.addRetain(aOp.insert.length);
          aOp.insert = "";
        }
        else {
          aPrime.addRetain(bOp.insert.length);
          bPrime.addInsert(bOp.insert);
          bOp.insert = "";
        }
      }
      else if (isInsert(aOp)) {
        aPrime.addInsert(aOp.insert);
        bPrime.addRetain(aOp.insert.length);
        aOp.insert = "";
      }
      else if (isInsert(bOp)) {
        bPrime.addInsert(bOp.insert);
        aPrime.addRetain(bOp.insert.length);
        bOp.insert = "";
      }

      // Below this line we can assume that aOp and bOp are Retain or Delete.
      else if (isRetain(aOp) && isRetain(bOp)) {
        // Case 1: both are Retain
        // Both operations have the same intention,
        // so we can retain the min(aOp.count, bOp.count) characters.
        const minCount = Math.min(aOp.retain, bOp.retain);
        aPrime.addRetain(minCount);
        bPrime.addRetain(minCount);
        aOp.retain -= minCount;
        bOp.retain -= minCount;
      }
      else if (isDelete(aOp) && isDelete(bOp)) {
        // Case 2: aOp is Delete and bOp is Delete
        // Both operations have the same intention,
        // so just skip the min(aOp.count, bOp.count) characters.
        // Note that we should do nothing in a' and b',
        // since the characters are already deleted in a and b,
        // and we don't need to move the cursor forward.
        const minCount = Math.min(aOp.delete, bOp.delete);
        aOp.delete -= minCount;
        bOp.delete -= minCount;
      }
      else if (isRetain(aOp) && isDelete(bOp)) {
        // Case 3: aOp is Retain and bOp is Delete
        // The main intention is to delete because Retain just skip the characters,
        // not have strong intention to keep them.
        // Therefore, in b' we need to delete characters since they are not deleted in a;
        // in a' we should do nothing for the same reason in Case 2.
        const minCount = Math.min(aOp.retain, bOp.delete);
        bPrime.addDelete(minCount);
        aOp.retain -= minCount;
        bOp.delete -= minCount;
      }
      else if (isDelete(aOp) && isRetain(bOp)) {
        // Case 4: aOp is Delete and bOp is Retain
        // The same as Case 3.
        const minCount = Math.min(aOp.delete, bOp.retain);
        aPrime.addDelete(minCount);
        aOp.delete -= minCount;
        bOp.retain -= minCount;
      }
      else
        throw new Error("Unknown type error");

      if (aOp !== undefined && isEmptyBasicOp(aOp)) {
        aOp = _.cloneDeep(a.operations[aInd]);
        aInd++;
      }
      if (bOp !== undefined && isEmptyBasicOp(bOp)) {
        bOp = _.cloneDeep(b.operations[bInd]);
        bInd++;
      }
    }
    if (aOp !== undefined || bOp !== undefined)
      throw new Error("Unknown runtime error.");

    return [aPrime, bPrime];
  }

  /**
   * Creates an `Operation` object from an array of `BasicOperation` objects.
   * 
   * @param ops - An array of `BasicOperation` objects.
   * @returns The created `Operation` object.
   */
  static fromBasicOperations(ops: BasicOperation[]): Operation {
    const res = new Operation();
    ops.forEach(op => {
      if (isRetain(op))
        res.addRetain(op.retain);
      else if (isInsert(op))
        res.addInsert(op.insert);
      else if (isDelete(op))
        res.addDelete(op.delete);
    })
    return res;
  }
}

export type { BasicOperation };
export { Operation, isDelete, isInsert, isRetain, isEmptyBasicOp };