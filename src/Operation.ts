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

// BasicOperation = string | number;
// op < 0: delete -op
// op > 0: retain op
// typeof op === string: insert op

// retain(5) ins("hi") del(3)   =>  [5, "hi", -3]



class OperationArray {
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

  // Return the inverse that apply(apply(doc, this), inverse) === doc.
  // Note that the argument should be original doc, not the result of apply(doc, this).
  invert(doc: string): OperationArray {
    const inverse = new OperationArray();
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

  // Returns a merged OperationArray equal to a + b.
  // Formally, apply(apply(doc, a), b) = apply(doc, compose(a, b)).
  // 
  // We can use a two-pointer approach to merge the two operations in O(n) time and space,
  // where n = max(a.operations.length, b.operations.length).
  //
  // It's worth noting that this function is recursive.
  // After merging the first two operations in a and b, we can move to the rest of the operations
  // without caring about the operations we've merged.
  // i.e. we can always assume that aOp and bOp are the first operations in doc.
  // Therefore, we can consider a to get the first several letters in apply(doc, a),
  // then consider that how b will change the result of those letters.
  static compose(a: OperationArray, b: OperationArray): OperationArray {
    const resArray = new OperationArray();

    if (a.targetLength !== b.baseLength)
      throw new Error("The base length of the second operation should be the target length of the first operation.");

    // Clone the first operation in a and b.
    // Note that we might change the count or content of the operation,
    // so to keep the arguments unchanged we need to clone them.
    let aOp = _.clone(a.operations[0]), bOp = _.clone(b.operations[0]);
    let aInd = 1, bInd = 1;
    while (aOp !== undefined && bOp !== undefined) {
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

      // Below this line we can assume that bOp is Retain or Delete.
      else if (aOp instanceof Retain && bOp instanceof Retain) {
        // Case 1: both are Retain
        // We can retain the min(aOp.count, bOp.count) characters and recursive.
        const minCount = Math.min(aOp.count, bOp.count);
        resArray.addRetain(minCount);
        aOp.count -= minCount;
        bOp.count -= minCount;
      }
      else if (aOp instanceof Retain && bOp instanceof Delete) {
        // Case 2: aOp is Retain and bOp is Delete
        // We can delete the min(aOp.count, bOp.count) characters and recursive.
        const minCount = Math.min(aOp.count, bOp.count);
        aOp.count -= minCount;
        bOp.count -= minCount;
      }
      else if (aOp instanceof Insert && bOp instanceof Retain) {
        // Case 3: aOp is Insert and bOp is Retain
        // We can insert the min(aOp.content.length, bOp.count) characters in aOp.content and recursive.
        const minCount = Math.min(aOp.content.length, bOp.count);
        resArray.addInsert(aOp.content.slice(0, minCount));
        aOp.content = aOp.content.slice(minCount);
        bOp.count -= minCount;
      }
      else if (aOp instanceof Insert && bOp instanceof Delete) {
        // Case 4: aOp is Insert and bOp is Delete
        // We can insert the min(aOp.content.length, bOp.count) characters and recursive.
        const minCount = Math.min(aOp.content.length, bOp.count);
        aOp.content = aOp.content.slice(minCount);
        bOp.count -= minCount;
      }

      if (aOp.isEmpty()) {
        aOp = a.operations[aInd];
        aInd++;
      }
      if (bOp.isEmpty()) {
        bOp = b.operations[bInd];
        bInd++;
      }
    }

    // Because a.targetLength === b.baseLength, this condition should always be false.
    // But for the sake of robustness, we keep it here.
    if (aOp !== undefined || bOp !== undefined)
      throw new Error("Unknown runtime error.");
    return resArray;
  }

  // Transform takes two operations A and B that happened concurrently and
  // produces two operations A' and B' (in an array) such that
  // `apply(apply(S, A), B') = apply(apply(S, B), A')`.
  // This function is the heart of OT.
  //
  // This function is also recursive.
  // We only need to keep the imaginary cursors in a and b at the same position,
  // then we can always assume that aOp and bOp are the first operations in doc.
  static transform(a: OperationArray, b: OperationArray): [OperationArray, OperationArray] {
    if (a.baseLength !== b.baseLength)
      throw new Error("Both operations should have the same base length.");

    const aPrime = new OperationArray(), bPrime = new OperationArray();

    let aOp = _.clone(a.operations[0]), bOp = _.clone(b.operations[0]);
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
        aOp = _.clone(a.operations[aInd]);
        aInd++;
      }
      if (bOp !== undefined && bOp.isEmpty()) {
        bOp = _.clone(b.operations[bInd]);
        bInd++;
      }
    }
    if (aOp !== undefined || bOp !== undefined) 
      throw new Error("Unknown runtime error.");

    return [aPrime, bPrime];
  }
}

export { OperationArray, Insert, Delete, Retain };