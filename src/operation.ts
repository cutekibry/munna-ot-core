import * as _ from "lodash";

class Retain {
  count: number;
  constructor(count: number) {
    this.count = count;
  }
  isEmpty(): boolean { return this.count === 0; }
}
class Insert {
  content: string;
  constructor(content: string) {
    this.content = content;
  }
  isEmpty(): boolean { return this.content === ""; }
}
class Delete {
  count: number;
  constructor(count: number) {
    this.count = count;
  }
  isEmpty(): boolean { return this.count === 0; }
}
type BasicOperation = Retain | Insert | Delete;


class Operation {
  operations: BasicOperation[] = [];
  baseLength: number = 0;
  targetLength: number = 0;

  addRetain(n: number): this {
    if (n === 0)
      return this;
    this.baseLength += n;
    this.targetLength += n;

    const back = this.operations[this.operations.length - 1];
    if (back instanceof Retain)
      back.count += n;
    else
      this.operations.push(new Retain(n));
    return this;
  }
  addInsert(str: string): this {
    if (str === "")
      return this;
    this.targetLength += str.length;

    const back = this.operations[this.operations.length - 1];
    if (back instanceof Insert)
      back.content += str;
    else
      this.operations.push(new Insert(str));
    return this;
  }
  addDelete(n: number): this {
    if (n === 0)
      return this;

    this.baseLength += n;

    const back = this.operations[this.operations.length - 1];
    if (back instanceof Delete)
      back.count += n;
    else
      this.operations.push(new Delete(n));
    return this;
  }

  apply(doc: string): string {
    if (doc.length !== this.baseLength)
      throw new Error("The operation's base length must be equal to the document's length.");

    const resStr: string[] = [];
    let ind = 0;

    this.operations.forEach(op => {
      if (op instanceof Retain) {
        if (ind + op.count > doc.length)
          throw new Error("The string is too short.");
        resStr.push(doc.slice(ind, ind + op.count));
        ind += op.count;
      }
      else if (op instanceof Insert)
        resStr.push(op.content);
      else if (op instanceof Delete)
        ind += op.count;
    })

    if (ind !== doc.length)
      throw new Error("The operation's target length must be equal to the document's length.");

    return resStr.join("");
  }

  /**
   * Returns the inverse of `this` that `apply(apply(doc, this), inverse) === doc`.
   * Note that the argument should be original doc, not the result of apply(doc, this).
   * 
   * @param doc The original document.
   * @returns The inverse of `this`.
   */
  invert(doc: string): Operation {
    const inverse = new Operation();
    let ind = 0;

    this.operations.forEach(op => {
      if (op instanceof Retain) {
        inverse.addRetain(op.count);
        ind += op.count;
      }
      else if (op instanceof Insert)
        inverse.addDelete(op.content.length);
      else if (op instanceof Delete) {
        inverse.addInsert(doc.slice(ind, ind + op.count));
        ind += op.count;
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
      if (aOp instanceof Delete) {
        resArray.addDelete(aOp.count);
        aOp.count = 0;
      }

      // Below this line we can assume that aOp is Retain or Insert.
      // In this case, if bOp is Insert, we can just add it to the result
      // for the same reason as above.
      else if (bOp instanceof Insert) {
        resArray.addInsert(bOp.content);
        bOp.content = "";
      }

      else if (aOp === undefined || bOp === undefined)
        throw new Error("Infinite loop error");

      // Below this line we can assume that bOp is Retain or Delete.
      else if (aOp instanceof Retain && bOp instanceof Retain) {
        // Case 1: both are Retain
        // We can retain the min(aOp.count, bOp.count) characters in document and recursive.
        const minCount = Math.min(aOp.count, bOp.count);
        resArray.addRetain(minCount);
        aOp.count -= minCount;
        bOp.count -= minCount;
      }
      else if (aOp instanceof Retain && bOp instanceof Delete) {
        // Case 2: aOp is Retain and bOp is Delete
        // We can delete the min(aOp.count, bOp.count) characters in document and recursive.
        const minCount = Math.min(aOp.count, bOp.count);
        resArray.addDelete(minCount);
        aOp.count -= minCount;
        bOp.count -= minCount;
      }
      else if (aOp instanceof Insert && bOp instanceof Retain) {
        // Case 3: aOp is Insert and bOp is Retain
        // We can insert the min(aOp.content.length, bOp.count) characters into document and recursive.
        const minCount = Math.min(aOp.content.length, bOp.count);
        resArray.addInsert(aOp.content.slice(0, minCount));
        aOp.content = aOp.content.slice(minCount);
        bOp.count -= minCount;
      }
      else if (aOp instanceof Insert && bOp instanceof Delete) {
        // Case 4: aOp is Insert and bOp is Delete
        // We can delete the first min(aOp.content.length, bOp.count) characters in aOp.content and recursive.
        const minCount = Math.min(aOp.content.length, bOp.count);
        aOp.content = aOp.content.slice(minCount);
        bOp.count -= minCount;
      }

      if (aOp !== undefined && aOp.isEmpty()) {
        aOp = _.cloneDeep(a.operations[aInd]);
        aInd++;
      }
      if (bOp !== undefined && bOp.isEmpty()) {
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
      if (aOp instanceof Insert && bOp instanceof Insert) {
        // If both are Insert, we can just move them to the result.
        // To ensure transform(a, b) and transform(b, a) return the same a' and b',
        // we need to have a strict order of aOp and bOp.
        // We can simply compare the content.
        if (aOp.content < bOp.content) {
          aPrime.addInsert(aOp.content);
          bPrime.addRetain(aOp.content.length);
          aOp.content = "";
        }
        else {
          aPrime.addRetain(bOp.content.length);
          bPrime.addInsert(bOp.content);
          bOp.content = "";
        }
      }
      else if (aOp instanceof Insert) {
        aPrime.addInsert(aOp.content);
        bPrime.addRetain(aOp.content.length);
        aOp.content = "";
      }
      else if (bOp instanceof Insert) {
        bPrime.addInsert(bOp.content);
        aPrime.addRetain(bOp.content.length);
        bOp.content = "";
      }

      // Below this line we can assume that aOp and bOp are Retain or Delete.
      else if (aOp instanceof Retain && bOp instanceof Retain) {
        // Case 1: both are Retain
        // Both operations have the same intention,
        // so we can retain the min(aOp.count, bOp.count) characters.
        const minCount = Math.min(aOp.count, bOp.count);
        aPrime.addRetain(minCount);
        bPrime.addRetain(minCount);
        aOp.count -= minCount;
        bOp.count -= minCount;
      }
      else if (aOp instanceof Delete && bOp instanceof Delete) {
        // Case 2: aOp is Delete and bOp is Delete
        // Both operations have the same intention,
        // so just skip the min(aOp.count, bOp.count) characters.
        // Note that we should do nothing in a' and b',
        // since the characters are already deleted in a and b,
        // and we don't need to move the cursor forward.
        const minCount = Math.min(aOp.count, bOp.count);
        aOp.count -= minCount;
        bOp.count -= minCount;
      }
      else if (aOp instanceof Retain && bOp instanceof Delete) {
        // Case 3: aOp is Retain and bOp is Delete
        // The main intention is to delete because Retain just skip the characters,
        // not have strong intention to keep them.
        // Therefore, in b' we need to delete characters since they are not deleted in a;
        // in a' we should do nothing for the same reason in Case 2.
        const minCount = Math.min(aOp.count, bOp.count);
        bPrime.addDelete(minCount);
        aOp.count -= minCount;
        bOp.count -= minCount;
      }
      else if (aOp instanceof Delete && bOp instanceof Retain) {
        // Case 4: aOp is Delete and bOp is Retain
        // The same as Case 3.
        const minCount = Math.min(aOp.count, bOp.count);
        aPrime.addDelete(minCount);
        aOp.count -= minCount;
        bOp.count -= minCount;
      }
      else
        throw new Error("Unknown type error");

      if (aOp !== undefined && aOp.isEmpty()) {
        aOp = _.cloneDeep(a.operations[aInd]);
        aInd++;
      }
      if (bOp !== undefined && bOp.isEmpty()) {
        bOp = _.cloneDeep(b.operations[bInd]);
        bInd++;
      }
    }
    if (aOp !== undefined || bOp !== undefined)
      throw new Error("Unknown runtime error.");

    return [aPrime, bPrime];
  }
}

export { Operation, Insert, Delete, Retain };