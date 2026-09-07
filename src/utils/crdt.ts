/**
 * Replicated Growable Array (RGA) / Fractional Indexing CRDT Implementation
 * 
 * Provides mathematically sound conflict-free replicated data type operations
 * for collaborative text editing. Handles concurrent edits, deterministic tie-breaking,
 * causality tracking via Lamport timestamps, and cursor position preservation
 * across high-latency network conditions.
 */

export interface CRDTChar {
  id: string; // Unique identifier: `${peerId}:${clock}:${seq}`
  peerId: string;
  clock: number;
  char: string;
  pos: number[]; // Fractional index vector for deterministic total ordering
  deleted: boolean;
}

export type CRDTOpType = "insert" | "delete";

export interface CRDTOperation {
  type: CRDTOpType;
  id: string;
  peerId: string;
  clock: number;
  char?: string;
  pos?: number[];
  targetId?: string; // For delete operations: the ID of the char being deleted
}

export interface CRDTStats {
  totalOpsGenerated: number;
  totalOpsApplied: number;
  conflictsResolved: number;
  activeCharCount: number;
  tombstoneCount: number;
}

/**
 * Compare two fractional positions lexicographically.
 * Returns negative if A < B, positive if A > B, 0 if A === B.
 */
export function comparePositions(posA: number[], posB: number[]): number {
  const maxLen = Math.max(posA.length, posB.length);
  for (let i = 0; i < maxLen; i++) {
    const a = i < posA.length ? posA[i] : 0;
    const b = i < posB.length ? posB[i] : 0;
    if (a !== b) {
      return a - b;
    }
  }
  return posA.length - posB.length;
}

/**
 * Compare two CRDT characters for total deterministic order.
 * Primary key: Fractional position vector.
 * Secondary key (tie-breaker for concurrent inserts): Lamport Clock.
 * Tertiary key: Peer ID string comparison.
 */
export function compareChars(a: CRDTChar, b: CRDTChar): number {
  const posComp = comparePositions(a.pos, b.pos);
  if (posComp !== 0) return posComp;

  // Concurrent tie-breaker: higher clock wins (or lower clock for determinism)
  if (a.clock !== b.clock) {
    return a.clock - b.clock;
  }
  return a.peerId.localeCompare(b.peerId);
}

/**
 * Generate a new fractional position array between leftPos and rightPos.
 * Generates an evenly distributed position between bounds.
 */
export function generatePositionBetween(
  leftPos: number[] | null,
  rightPos: number[] | null,
  indexInBatch: number = 0,
  batchSize: number = 1
): number[] {
  const left = leftPos && leftPos.length > 0 ? [...leftPos] : [0];
  const right = rightPos && rightPos.length > 0 ? [...rightPos] : [left[0] + 1000];

  // Base spacing allocation
  const step = 32;
  const maxLen = Math.max(left.length, right.length);
  const result: number[] = [];

  let matchedPrefix = true;
  for (let i = 0; i < maxLen; i++) {
    const l = i < left.length ? left[i] : 0;
    const r = i < right.length ? right[i] : 0;

    if (matchedPrefix) {
      if (l === r) {
        result.push(l);
      } else if (r - l > 1) {
        // Space between l and r
        const delta = (r - l) / (batchSize + 1);
        const nextVal = Math.floor(l + delta * (indexInBatch + 1));
        result.push(nextVal);
        matchedPrefix = false;
        break;
      } else {
        // r - l === 1: no integer space at this level, go deeper
        result.push(l);
        // Continue to next level
      }
    }
  }

  if (matchedPrefix) {
    // Need to append deeper dimension
    const nextVal = Math.floor(step * (indexInBatch + 1));
    result.push(nextVal);
  }

  return result;
}

export class TextCRDTDoc {
  public peerId: string;
  public lamportClock: number = 0;
  private chars: CRDTChar[] = [];
  private charMap: Map<string, CRDTChar> = new Map();
  public stats: CRDTStats = {
    totalOpsGenerated: 0,
    totalOpsApplied: 0,
    conflictsResolved: 0,
    activeCharCount: 0,
    tombstoneCount: 0,
  };

  constructor(
  peerId: string,
  initialText?: string,
  documentId: string = "default"
) {
  this.peerId = peerId;
  if (initialText) {
    this.initFromText(initialText, documentId);
  }
}

  /**
   * Reset document and initialize from raw text.
   */
  public initFromText(text: string, documentId: string = "default") {
    this.chars = [];
    this.charMap.clear();
    this.lamportClock = 0;

    let prevPos: number[] = [0];
    for (let i = 0; i < text.length; i++) {
      this.lamportClock++;
      const pos = [100 * (i + 1)];
      const charObj: CRDTChar = {
       id: `${documentId}:init:${i}`,
        peerId: this.peerId,
        clock: this.lamportClock,
        char: text[i],
        pos,
        deleted: false,
      };
      this.chars.push(charObj);
      this.charMap.set(charObj.id, charObj);
      prevPos = pos;
    }

    this.updateStats();
  }

  /**
   * Get the current visible text content.
   */
  public getText(): string {
    let result = "";
    for (let i = 0; i < this.chars.length; i++) {
      if (!this.chars[i].deleted) {
        result += this.chars[i].char;
      }
    }
    return result;
  }

  /**
   * Get visible characters only.
   */
  public getVisibleChars(): CRDTChar[] {
    return this.chars.filter((c) => !c.deleted);
  }

  /**
   * Insert text at a visible character index.
   * Returns the generated CRDT operations to broadcast to peers.
   */
  public insert(visibleIndex: number, text: string): CRDTOperation[] {
    if (!text || text.length === 0) return [];

    const visible = this.getVisibleChars();
    const leftChar = visibleIndex > 0 ? visible[visibleIndex - 1] : null;
    const rightChar = visibleIndex < visible.length ? visible[visibleIndex] : null;

    const leftPos = leftChar ? leftChar.pos : [0];
    const rightPos = rightChar ? rightChar.pos : [leftPos[0] + 1000 * (text.length + 1)];

    const ops: CRDTOperation[] = [];

    for (let i = 0; i < text.length; i++) {
      this.lamportClock++;
      const pos = generatePositionBetween(leftPos, rightPos, i, text.length);
      const charObj: CRDTChar = {
        id: `${this.peerId}:${this.lamportClock}:${i}`,
        peerId: this.peerId,
        clock: this.lamportClock,
        char: text[i],
        pos,
        deleted: false,
      };

      this.insertCharSorted(charObj);
      this.charMap.set(charObj.id, charObj);

      const op: CRDTOperation = {
        type: "insert",
        id: charObj.id,
        peerId: this.peerId,
        clock: this.lamportClock,
        char: charObj.char,
        pos: charObj.pos,
      };
      ops.push(op);
      this.stats.totalOpsGenerated++;
    }

    this.updateStats();
    return ops;
  }

  /**
   * Delete count characters starting at visibleIndex.
   * Marks corresponding CRDT characters as deleted (tombstones).
   */
  public delete(visibleIndex: number, count: number): CRDTOperation[] {
    if (count <= 0) return [];

    const visible = this.getVisibleChars();
    const ops: CRDTOperation[] = [];

    const end = Math.min(visibleIndex + count, visible.length);
    for (let i = visibleIndex; i < end; i++) {
      const targetChar = visible[i];
      if (targetChar && !targetChar.deleted) {
        targetChar.deleted = true;
        this.lamportClock++;

        const op: CRDTOperation = {
          type: "delete",
          id: `${this.peerId}:del:${this.lamportClock}:${targetChar.id}`,
          peerId: this.peerId,
          clock: this.lamportClock,
          targetId: targetChar.id,
        };
        ops.push(op);
        this.stats.totalOpsGenerated++;
      }
    }

    this.updateStats();
    return ops;
  }

  /**
   * Apply incoming remote CRDT operations to the document.
   * Handles concurrent conflict resolution deterministically.
   */
  public applyRemoteOps(ops: CRDTOperation[]): {
    text: string;
    conflictsResolved: number;
    affectedPositions: number[];
  } {
    let conflictsResolved = 0;
    const affectedPositions: number[] = [];

    for (const op of ops) {
      // Update Lamport clock causality
      this.lamportClock = Math.max(this.lamportClock, op.clock) + 1;
      this.stats.totalOpsApplied++;

      if (op.type === "insert" && op.pos && op.char !== undefined) {
        // Check if already applied (idempotency)
        if (this.charMap.has(op.id)) {
          continue;
        }

        const newChar: CRDTChar = {
          id: op.id,
          peerId: op.peerId,
          clock: op.clock,
          char: op.char,
          pos: op.pos,
          deleted: false,
        };

        // Check for concurrent collision: another character exists with exact same position
        const collision = this.chars.some(
          (c) => comparePositions(c.pos, op.pos!) === 0 && c.id !== op.id
        );
        if (collision) {
          conflictsResolved++;
          this.stats.conflictsResolved++;
        }

        const visibleIdx = this.insertCharSorted(newChar);
        this.charMap.set(newChar.id, newChar);
        affectedPositions.push(visibleIdx);
      } else if (op.type === "delete" && op.targetId) {
        const target = this.charMap.get(op.targetId);
        if (target && !target.deleted) {
          target.deleted = true;
          this.stats.conflictsResolved++;
          conflictsResolved++;
        }
      }
    }

    this.updateStats();
    return {
      text: this.getText(),
      conflictsResolved,
      affectedPositions,
    };
  }

  /**
   * Insert character into the sorted array maintaining deterministic total order.
   * Returns the visible index of the inserted character.
   */
  private insertCharSorted(newChar: CRDTChar): number {
    let low = 0;
    let high = this.chars.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      if (compareChars(this.chars[mid], newChar) < 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    this.chars.splice(low, 0, newChar);

    // Calculate visible index of this inserted character
    let visibleCount = 0;
    for (let i = 0; i < low; i++) {
      if (!this.chars[i].deleted) {
        visibleCount++;
      }
    }
    return visibleCount;
  }

  /**
   * Reconcile local raw text edit (from <textarea>) with the CRDT document.
   * Computes minimal diff between current CRDT text and new text, executes
   * surgical insert and delete operations, and returns the generated ops to broadcast.
   */
  public reconcileWithText(newText: string): CRDTOperation[] {
    const oldText = this.getText();
    if (oldText === newText) return [];

    // Find common prefix
    let prefixLen = 0;
    const minLen = Math.min(oldText.length, newText.length);
    while (prefixLen < minLen && oldText[prefixLen] === newText[prefixLen]) {
      prefixLen++;
    }

    // Find common suffix
    let oldSuffix = oldText.length - 1;
    let newSuffix = newText.length - 1;
    while (oldSuffix >= prefixLen && newSuffix >= prefixLen && oldText[oldSuffix] === newText[newSuffix]) {
      oldSuffix--;
      newSuffix--;
    }

    const deleteCount = oldSuffix - prefixLen + 1;
    const insertedSubstring = newText.slice(prefixLen, newSuffix + 1);

    const generatedOps: CRDTOperation[] = [];

    // Perform deletions first if any
    if (deleteCount > 0) {
      const delOps = this.delete(prefixLen, deleteCount);
      generatedOps.push(...delOps);
    }

    // Perform insertions if any
    if (insertedSubstring.length > 0) {
      const insOps = this.insert(prefixLen, insertedSubstring);
      generatedOps.push(...insOps);
    }

    return generatedOps;
  }

  /**
   * Transform a local cursor position (in visible text offset) against incoming remote ops.
   * This is the core algorithm that prevents cursor jumping when remote collaborators type.
   */
  public transformCursor(cursorOffset: number, remoteOps: CRDTOperation[]): number {
    let transformed = cursorOffset;

    for (const op of remoteOps) {
      if (op.type === "insert" && op.pos && op.char !== undefined) {
        // Determine the visible index where this character landed
        const char = this.charMap.get(op.id);
        if (!char) continue;

        let charVisibleIndex = 0;
        for (let i = 0; i < this.chars.length; i++) {
          if (this.chars[i].id === op.id) {
            break;
          }
          if (!this.chars[i].deleted) {
            charVisibleIndex++;
          }
        }

        // If remote character was inserted before or at the cursor, advance cursor
        if (charVisibleIndex <= transformed) {
          transformed += op.char.length;
        }
      } else if (op.type === "delete" && op.targetId) {
        const char = this.charMap.get(op.targetId);
        if (!char) continue;

        let charVisibleIndex = 0;
        for (let i = 0; i < this.chars.length; i++) {
          if (this.chars[i].id === op.targetId) {
            break;
          }
          if (!this.chars[i].deleted) {
            charVisibleIndex++;
          }
        }

        // If deleted character was before cursor, retreat cursor
        if (charVisibleIndex < transformed) {
          transformed = Math.max(0, transformed - 1);
        }
      }
    }

    return transformed;
  }

  private updateStats() {
    let active = 0;
    let tombstones = 0;
    for (let i = 0; i < this.chars.length; i++) {
      if (this.chars[i].deleted) {
        tombstones++;
      } else {
        active++;
      }
    }
    this.stats.activeCharCount = active;
    this.stats.tombstoneCount = tombstones;
  }
}
