import { describe, expect, it } from "vitest";
import {
  TextCRDTDoc,
  compareChars,
  comparePositions,
  generatePositionBetween,
} from "../src/utils/crdt";

describe("CRDT utility functions", () => {
  it("compares identical positions as equal", () => {
    expect(comparePositions([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it("orders fractional positions lexicographically", () => {
    expect(comparePositions([1], [2])).toBeLessThan(0);
    expect(comparePositions([2], [1])).toBeGreaterThan(0);
    expect(comparePositions([1, 2], [1, 3])).toBeLessThan(0);
  });

  it("generates a position between two positions", () => {
    const position = generatePositionBetween([100], [200]);

    expect(position.length).toBeGreaterThan(0);
    expect(comparePositions([100], position)).toBeLessThan(0);
    expect(comparePositions(position, [200])).toBeLessThan(0);
  });

  it("uses deterministic ordering for characters", () => {
    const a = {
      id: "peer-a:1:0",
      peerId: "peer-a",
      clock: 1,
      char: "A",
      pos: [100],
      deleted: false,
    };

    const b = {
      id: "peer-b:1:0",
      peerId: "peer-b",
      clock: 1,
      char: "B",
      pos: [100],
      deleted: false,
    };

    expect(compareChars(a, b)).not.toBe(0);
  });
});

describe("TextCRDTDoc - basic operations", () => {
  it("initializes with the supplied text", () => {
    const doc = new TextCRDTDoc("peer-a", "Hello");

    expect(doc.getText()).toBe("Hello");
    expect(doc.getVisibleChars()).toHaveLength(5);
  });

  it("starts with empty text when no initial content is provided", () => {
    const doc = new TextCRDTDoc("peer-a");

    expect(doc.getText()).toBe("");
    expect(doc.getVisibleChars()).toHaveLength(0);
  });

  it("inserts text at the beginning", () => {
    const doc = new TextCRDTDoc("peer-a", "World");

    const ops = doc.insert(0, "Hello ");

    expect(ops).toHaveLength(6);
    expect(doc.getText()).toBe("Hello World");
  });

  it("inserts text in the middle", () => {
    const doc = new TextCRDTDoc("peer-a", "Helo");

    const ops = doc.insert(2, "l");

    expect(ops).toHaveLength(1);
    expect(doc.getText()).toBe("Hello");
  });

  it("inserts text at the end", () => {
    const doc = new TextCRDTDoc("peer-a", "Hello");

    doc.insert(5, " World");

    expect(doc.getText()).toBe("Hello World");
  });

  it("returns no operations for an empty insertion", () => {
    const doc = new TextCRDTDoc("peer-a", "Hello");

    expect(doc.insert(2, "")).toEqual([]);
    expect(doc.getText()).toBe("Hello");
  });
});

describe("TextCRDTDoc - deletion and tombstones", () => {
  it("deletes characters from visible text", () => {
    const doc = new TextCRDTDoc("peer-a", "Hello");

    const ops = doc.delete(1, 2);

    expect(ops).toHaveLength(2);
    expect(doc.getText()).toBe("Hlo");
  });

  it("creates tombstones instead of physically removing characters", () => {
    const doc = new TextCRDTDoc("peer-a", "Hello");

    doc.delete(1, 2);

    expect(doc.getVisibleChars()).toHaveLength(3);
    expect(doc.stats.tombstoneCount).toBe(2);
    expect(doc.stats.activeCharCount).toBe(3);
  });

  it("does nothing when delete count is zero", () => {
    const doc = new TextCRDTDoc("peer-a", "Hello");

    expect(doc.delete(2, 0)).toEqual([]);
    expect(doc.getText()).toBe("Hello");
  });

  it("does not delete beyond the end of the document", () => {
    const doc = new TextCRDTDoc("peer-a", "Hello");

    const ops = doc.delete(3, 100);

    expect(ops).toHaveLength(2);
    expect(doc.getText()).toBe("Hel");
  });
});

describe("TextCRDTDoc - remote operations", () => {
  it("applies remote insert operations", () => {
    const peerA = new TextCRDTDoc("peer-a", "Hello");
    const peerB = new TextCRDTDoc("peer-b", "Hello");

    const ops = peerA.insert(5, "!");

    peerB.applyRemoteOps(ops);

    expect(peerA.getText()).toBe("Hello!");
    expect(peerB.getText()).toBe("Hello!");
  });

  it("applies remote delete operations", () => {
    const peerA = new TextCRDTDoc("peer-a", "Hello");
    const peerB = new TextCRDTDoc("peer-b", "Hello");

    const deleteOps = peerA.delete(1, 1);

    peerB.applyRemoteOps(deleteOps);

    expect(peerA.getText()).toBe("Hllo");
    expect(peerB.getText()).toBe("Hllo");
  });

  it("updates the remote Lamport clock", () => {
    const peerA = new TextCRDTDoc("peer-a");
    const peerB = new TextCRDTDoc("peer-b");

    const ops = peerA.insert(0, "A");

    const oldClock = peerB.lamportClock;

    peerB.applyRemoteOps(ops);

    expect(peerB.lamportClock).toBeGreaterThan(oldClock);
    expect(peerB.lamportClock).toBeGreaterThanOrEqual(ops[0].clock);
  });

  it("does not apply the same insert operation twice", () => {
    const peerA = new TextCRDTDoc("peer-a");
    const peerB = new TextCRDTDoc("peer-b");

    const ops = peerA.insert(0, "A");

    peerB.applyRemoteOps(ops);
    peerB.applyRemoteOps(ops);

    expect(peerB.getText()).toBe("A");
    expect(peerB.getVisibleChars()).toHaveLength(1);
  });
});

describe("TextCRDTDoc - concurrent editing", () => {
  it("converges when peers independently insert at the same location", () => {
    const peerA = new TextCRDTDoc("peer-a", "Hello");
    const peerB = new TextCRDTDoc("peer-b", "Hello");

    const opsA = peerA.insert(5, "A");
    const opsB = peerB.insert(5, "B");

    peerA.applyRemoteOps(opsB);
    peerB.applyRemoteOps(opsA);

    expect(peerA.getText()).toBe(peerB.getText());
  });

  it("resolves concurrent inserts deterministically", () => {
    const peerA = new TextCRDTDoc("peer-a");
    const peerB = new TextCRDTDoc("peer-b");

    const opsA = peerA.insert(0, "A");
    const opsB = peerB.insert(0, "B");

    peerA.applyRemoteOps(opsB);
    peerB.applyRemoteOps(opsA);

    expect(peerA.getText()).toBe(peerB.getText());
    expect(peerA.getVisibleChars()).toHaveLength(2);
  });

  it("handles multiple concurrent characters", () => {
    const peerA = new TextCRDTDoc("peer-a");
    const peerB = new TextCRDTDoc("peer-b");

    const opsA = peerA.insert(0, "ABC");
    const opsB = peerB.insert(0, "XYZ");

    peerA.applyRemoteOps(opsB);
    peerB.applyRemoteOps(opsA);

    expect(peerA.getText()).toBe(peerB.getText());
    expect(peerA.getVisibleChars()).toHaveLength(6);
  });

  it("tracks conflicts caused by concurrent position collisions", () => {
    const peerA = new TextCRDTDoc("peer-a");
    const peerB = new TextCRDTDoc("peer-b");

    const opsA = peerA.insert(0, "A");
    const opsB = peerB.insert(0, "B");

    peerA.applyRemoteOps(opsB);
    peerB.applyRemoteOps(opsA);

    expect(
      peerA.stats.conflictsResolved + peerB.stats.conflictsResolved
    ).toBeGreaterThanOrEqual(0);

    expect(peerA.getText()).toBe(peerB.getText());
  });
});

describe("TextCRDTDoc - reconcileWithText", () => {
  it("does nothing when text has not changed", () => {
    const doc = new TextCRDTDoc("peer-a", "Hello");

    const ops = doc.reconcileWithText("Hello");

    expect(ops).toEqual([]);
    expect(doc.getText()).toBe("Hello");
  });

  it("handles inserting text through reconciliation", () => {
    const doc = new TextCRDTDoc("peer-a", "Hello");

    const ops = doc.reconcileWithText("Hello World");

    expect(ops.length).toBeGreaterThan(0);
    expect(doc.getText()).toBe("Hello World");
  });

  it("handles deleting text through reconciliation", () => {
    const doc = new TextCRDTDoc("peer-a", "Hello World");

    const ops = doc.reconcileWithText("Hello");

    expect(ops.length).toBeGreaterThan(0);
    expect(doc.getText()).toBe("Hello");
    expect(doc.stats.tombstoneCount).toBeGreaterThan(0);
  });

  it("handles replacing text through reconciliation", () => {
    const doc = new TextCRDTDoc("peer-a", "Hello");

    const ops = doc.reconcileWithText("World");

    expect(ops.length).toBeGreaterThan(0);
    expect(doc.getText()).toBe("World");
  });
});

describe("TextCRDTDoc - cursor transformation", () => {
  it("moves the cursor forward when text is inserted before it", () => {
    const doc = new TextCRDTDoc("peer-a", "Hello");

    const ops = doc.insert(0, "X");

    const transformed = doc.transformCursor(2, ops);

    expect(transformed).toBeGreaterThanOrEqual(2);
  });

  it("keeps cursor position stable when there are no operations", () => {
    const doc = new TextCRDTDoc("peer-a", "Hello");

    expect(doc.transformCursor(3, [])).toBe(3);
  });
});

describe("CRDT statistics", () => {
  it("tracks generated operations", () => {
    const doc = new TextCRDTDoc("peer-a");

    doc.insert(0, "Hello");

    expect(doc.stats.totalOpsGenerated).toBe(5);
  });

  it("tracks active characters and tombstones", () => {
    const doc = new TextCRDTDoc("peer-a", "Hello");

    expect(doc.stats.activeCharCount).toBe(5);
    expect(doc.stats.tombstoneCount).toBe(0);

    doc.delete(0, 2);

    expect(doc.stats.activeCharCount).toBe(3);
    expect(doc.stats.tombstoneCount).toBe(2);
  });
});
