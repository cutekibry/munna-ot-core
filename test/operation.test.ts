import _ from "lodash";
import { Operation } from "../lib/operation";

import { it, describe, expect } from "vitest";


const DOC = "0123456789";


function apply(doc: string, ...args: Operation[]) {
  return args.reduce((acc, op) => op.apply(acc), doc);
}
function generateOperation(newDoc: string) {
  const res = new Operation();
  let oldInd = -1;
  let newInd: number;
  newDoc.split("").forEach(ch => {
    if ("0" <= ch && ch <= "9") {
      newInd = ch.charCodeAt(0) - "0".charCodeAt(0);
      res.addDelete(newInd - oldInd - 1);
      res.addRetain(1);
      oldInd = newInd;
    }
    else
      res.addInsert(ch);
  })
  res.addDelete(DOC.length - oldInd - 1);
  return res;
}
function InsertOperation(pos: number, str: string) {
  return DOC.slice(0, pos) + str + DOC.slice(pos);
}
function DeleteOperation(pos: number, len: number) {
  return DOC.slice(0, pos) + DOC.slice(pos + len);
}

function Insert(length: number, pos: number, str: string) {
  return (new Operation()).addRetain(pos).addInsert(str).addRetain(length - pos);
}
function Delete(length: number, pos: number, count: number) {
  return (new Operation()).addRetain(pos).addDelete(count).addRetain(length - pos - count);
}


function isIntentionKept(newDoc: string, a: string, b: string) {
  let flag = true;

  DOC.split("").forEach(ch => {
    if ((a.indexOf(ch) !== -1 && b.indexOf(ch) !== -1) !== (newDoc.indexOf(ch) !== -1))
      flag = false;
  });

  [...a.matchAll(/\D+/g), ...b.matchAll(/\D+/g)].forEach(match => {
    if (newDoc.indexOf(match[0]) === -1)
      flag = false;
  });

  return flag;
}

describe("Operation", () => {
  describe("Operation.compose", () => {
    function test(desc: string, a: Operation, b: Operation) {
      describe(desc, () => {
        describe(`apply(doc, a) = "${apply(DOC, a)}", apply(doc, a, b) = "${apply(DOC, a, b)}"`, () => {
          const aClone = _.cloneDeep(a), bClone = _.cloneDeep(b);

          it("compose(a, b) === compose(a, b) (the second time)", () =>
            expect(Operation.compose(a, b)).toEqual(Operation.compose(a, b))
          );
          it("compose does not change the input", () => {
            expect(a).toEqual(aClone);
            expect(b).toEqual(bClone);
          })
          it("apply(doc, a, b) = apply(doc, compose(a, b))", () =>
            expect(apply(DOC, a, b)).toEqual(apply(DOC, Operation.compose(a, b)))
          );
        });
      });
    }

    describe("both are InsertOperation", () => {
      test("both in the beginning", Insert(10, 0, "abc"), Insert(13, 0, "defg"));
      test("both in the end", Insert(10, 10, "abc"), Insert(13, 10, "defg"));
      test("overlapped", Insert(10, 0, "abcd"), Insert(14, 2, "efghi"));
      test("not overlapped", Insert(10, 0, "abcd"), Insert(14, 5, "efghi"));
    });
    describe("one is InsertOperation and the other is DeleteOperation", () => {
      test("InsertOperation is before DeleteOperation and does not overlap", Insert(10, 0, "abcd"), Delete(14, 5, 3));
      test("InsertOperation is after DeleteOperation and does not overlap", Insert(10, 5, "abcd"), Delete(14, 0, 3));
      test("InsertOperation covers DeleteOperation", Insert(10, 0, "abcdefgh"), Delete(18, 2, 3));
      test("DeleteOperation covers InsertOperation", Insert(10, 2, "cd"), Delete(12, 0, 8));
      test("InsertOperation is before DeleteOperation and overlaps", Insert(10, 2, "abcdefg"), Delete(17, 5, 8));
      test("InsertOperation is after DeleteOperation and overlaps", Insert(10, 8, "abcdefg"), Delete(17, 2, 8));
    });
    describe("both are DeleteOperation", () => {
      test("both in the beginning", Delete(10, 0, 3), Delete(7, 0, 4));
      test("both in the end", Delete(10, 6, 4), Delete(6, 3, 3));
      test("first one is in the beginning and the second one is in the end", Delete(10, 0, 3), Delete(7, 3, 4));
      test("first one is in the end and the second one is in the beginning", Delete(10, 6, 4), Delete(6, 0, 3));
      test("delete the entire document", Delete(10, 3, 4), Delete(6, 0, 6));
    });
  })
  describe("Operation.transform", () => {
    function test(desc: string, aStr: string, bStr: string) {
      describe(desc, () => {
        describe(`apply(doc, a) = "${aStr}", apply(doc, b) = "${bStr}"`, () => {
          const a = generateOperation(aStr);
          const b = generateOperation(bStr);
          const aClone = _.cloneDeep(a), bClone = _.cloneDeep(b);
          const [aPrime, bPrime] = Operation.transform(a, b);
          const [bPrime2, aPrime2] = Operation.transform(b, a);
          const newDoc = apply(DOC, a, bPrime);

          it("transform(a, b) === transform(a, b) (the second time)", () =>
            expect([aPrime, bPrime]).toEqual(Operation.transform(a, b))
          );
          it("transform does not change the input", () => {
            expect(a).toEqual(aClone);
            expect(b).toEqual(bClone);
          });
          it("transform(a, b) === transform(b, a).reverse()", () =>
            expect([aPrime, bPrime]).toEqual([aPrime2, bPrime2])
          );
          it("apply(doc, a, b') === apply(doc, b, a')", () =>
            expect(apply(DOC, a, bPrime)).toEqual(apply(DOC, b, aPrime))
          );
          it(`intention kept (newDoc = "${newDoc}")`, () =>
            expect(isIntentionKept(newDoc, aStr, bStr)).toBeTruthy()
          );
        });
      });
    }

    describe("both are InsertOperation", () => {
      test("both in the beginning", InsertOperation(0, "abc"), InsertOperation(0, "defg"));
      test("overlapped", InsertOperation(0, "abcd"), InsertOperation(2, "efghi"));
      test("not overlapped", InsertOperation(0, "abcd"), InsertOperation(5, "efghi"));
      test("both in the end", InsertOperation(10, "abcd"), InsertOperation(10, "efghi"));
    });
    describe("one is InsertOperation and the other is DeleteOperation", () => {
      test("InsertOperation is before DeleteOperation", InsertOperation(0, "abcd"), DeleteOperation(5, 3));
      test("InsertOperation is after DeleteOperation", InsertOperation(5, "abcd"), DeleteOperation(0, 3));
      test("InsertOperation pos is in the middle of DeleteOperation", InsertOperation(2, "abcd"), DeleteOperation(1, 3));
      test("DeleteOperation is in the middle of InsertOperation", InsertOperation(1, "abcd"), DeleteOperation(2, 3));
      test("DeleteOperation deletes the pos of InsertOperation", InsertOperation(2, "abcd"), DeleteOperation(0, 4));
      test("DeleteOperation deletes the entire InsertOperation", InsertOperation(1, "abcd"), DeleteOperation(1, 5));
      test("DeleteOperation deletes the entire document", InsertOperation(5, "abcde"), DeleteOperation(0, 10));
    });
    describe("both are DeleteOperation", () => {
      test("both in the beginning", DeleteOperation(0, 3), DeleteOperation(0, 4));
      test("overlapped", DeleteOperation(0, 5), DeleteOperation(2, 4));
      test("not overlapped", DeleteOperation(0, 5), DeleteOperation(5, 4));
      test("both in the end", DeleteOperation(5, 4), DeleteOperation(5, 3));
      test("delete more than the length", DeleteOperation(5, 8), DeleteOperation(4, 5));
    });
    describe("complex cases", () => {
      test("complex 1", "01b34h7r8btqwrt9", "0345g78tewer9");
      test("complex 2", "ytr0pok1fr2fgtw3tt5yy9qweryf", "bt23hhw4g5yte6h8");
      test("complex 3", "", "bt23hhw4g5yte6h8");
    })
  });
});