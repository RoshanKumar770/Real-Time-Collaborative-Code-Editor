import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-json";
import { 
  GitMerge, 
  Activity, 
  Wifi, 
  Layers, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  ChevronDown,
  ShieldCheck,
  Zap
} from "lucide-react";
import { UserPresence, CodeFile } from "../types";
import { TextCRDTDoc, CRDTOperation } from "../utils/crdt";
import { socketService } from "../services/socket";
import { FileLanguageIcon } from "./FileLanguageIcon";
import { formatCode } from "../utils/codeFormatter";

interface CodeEditorProps {
  file: CodeFile;
  users: UserPresence[];
  currentUser: UserPresence | null;
  roomId?: string;
  onCodeChange: (newContent: string, crdtOps?: CRDTOperation[], isRemoteMerge?: boolean) => void;
  onCursorChange: (cursor: { line: number; ch: number } | null, selection: any) => void;
  onRunCode: () => void;
  onSaveCheckpoint: () => void;
  onRegisterPrettify?: (prettifyFn: () => Promise<void>) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  file,
  users,
  currentUser,
  roomId = "global-workspace",
  onCodeChange,
  onCursorChange,
  onRunCode,
  onSaveCheckpoint,
  onRegisterPrettify,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const cursorsLayerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // CRDT Engine references
  const crdtDocRef = useRef<TextCRDTDoc>(
    new TextCRDTDoc(currentUser?.id || `peer-${Math.random().toString(36).slice(2, 7)}`, file.content)
  );
  const lastContentRef = useRef<string>(file.content);
  const activeFileIdRef = useRef<string>(file.id);
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  // UI state
  const [cursorPos, setCursorPos] = useState<{ line: number; ch: number }>({ line: 1, ch: 1 });
  const [fontSize, setFontSize] = useState<number>(14);
  const [isCrdtMenuOpen, setIsCrdtMenuOpen] = useState<boolean>(false);
  const [simulatedLatency, setSimulatedLatency] = useState<number>(0);
  const [conflictsResolvedCount, setConflictsResolvedCount] = useState<number>(0);
  const [recentConflictNotice, setRecentConflictNotice] = useState<{
    author: string;
    timestamp: number;
    detail: string;
  } | null>(null);
  const [isFormatting, setIsFormatting] = useState<boolean>(false);
  const [formatNotice, setFormatNotice] = useState<{
    type: "success" | "error" | "info";
    message: string;
    timestamp: number;
  } | null>(null);

  // Auto-dismiss formatting notification after 3.5s
  useEffect(() => {
    if (!formatNotice) return;
    const timer = setTimeout(() => {
      setFormatNotice(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [formatNotice]);

  // Exact character width and integer line-height dynamically measured from the DOM
  const [charDimensions, setCharDimensions] = useState<{ width: number; height: number }>({
    width: 8.42,
    height: Math.round(14 * 1.6),
  });

  useEffect(() => {
    const span = document.createElement("span");
    span.style.fontFamily = "'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    span.style.fontSize = `${fontSize}px`;
    span.style.position = "absolute";
    span.style.visibility = "hidden";
    span.style.whiteSpace = "pre";
    span.textContent = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // 100 chars
    document.body.appendChild(span);
    const rect = span.getBoundingClientRect();
    const measuredWidth = rect.width / 100;
    const measuredHeight = Math.round(fontSize * 1.6);
    document.body.removeChild(span);

    if (measuredWidth > 0) {
      setCharDimensions({ width: measuredWidth, height: measuredHeight });
    }
  }, [fontSize]);

  const lineHeight = charDimensions.height;
  const charWidth = charDimensions.width;

  // Initialize or re-sync CRDT doc when file.id switches
  useEffect(() => {
    if (file.id !== activeFileIdRef.current) {
      activeFileIdRef.current = file.id;
      crdtDocRef.current = new TextCRDTDoc(
        currentUser?.id || `peer-${Math.random().toString(36).slice(2, 7)}`,
        file.content
      );
      lastContentRef.current = file.content;
      if (textareaRef.current) {
        textareaRef.current.value = file.content;
      }
    } else if (file.content !== lastContentRef.current) {
      // External content update (e.g. checkpoint restore)
      const currentStart = textareaRef.current?.selectionStart ?? selectionRef.current.start;
      const currentEnd = textareaRef.current?.selectionEnd ?? selectionRef.current.end;

      const diffOps = crdtDocRef.current.reconcileWithText(file.content);
      const newStart = crdtDocRef.current.transformCursor(currentStart, diffOps);
      const newEnd = crdtDocRef.current.transformCursor(currentEnd, diffOps);

      lastContentRef.current = file.content;
      if (textareaRef.current) {
        textareaRef.current.value = file.content;
        textareaRef.current.setSelectionRange(newStart, newEnd);
      }
      selectionRef.current = { start: newStart, end: newEnd };
    }
  }, [file.id, file.content, currentUser?.id]);

  // Update cursor position tracking
  const updateCursorTracking = useCallback(() => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd, selectionDirection, value } = textareaRef.current;
    selectionRef.current = { start: selectionStart, end: selectionEnd };

    // Determine the active caret position (respecting selection direction)
    const isBackward = selectionDirection === "backward";
    const activeCaretPos = isBackward ? selectionStart : selectionEnd;
    const textBefore = value.substring(0, activeCaretPos);
    const lineArr = textBefore.split("\n");
    const currentLine = lineArr.length;
    const currentCh = lineArr[lineArr.length - 1].length + 1;

    setCursorPos({ line: currentLine, ch: currentCh });

    // Handle selection if any
    let selObj = null;
    if (selectionStart !== selectionEnd) {
      const start = Math.min(selectionStart, selectionEnd);
      const end = Math.max(selectionStart, selectionEnd);

      const textStart = value.substring(0, start);
      const startLines = textStart.split("\n");
      const startLine = startLines.length;
      const startCh = startLines[startLines.length - 1].length + 1;

      const textEnd = value.substring(0, end);
      const endLines = textEnd.split("\n");
      const endLine = endLines.length;
      const endCh = endLines[endLines.length - 1].length + 1;

      selObj = {
        startLine,
        startCh,
        endLine,
        endCh,
      };
    }

    onCursorChange({ line: currentLine, ch: currentCh }, selObj);
  }, [onCursorChange]);

  // Click line number to focus and select that line
  const handleLineNumberClick = useCallback(
    (targetLine: number) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const linesArr = file.content.split("\n");
      let charIndex = 0;
      for (let i = 0; i < targetLine - 1 && i < linesArr.length; i++) {
        charIndex += linesArr[i].length + 1;
      }
      const lineLen = linesArr[targetLine - 1]?.length || 0;
      textarea.focus();
      textarea.setSelectionRange(charIndex, charIndex + lineLen);
      updateCursorTracking();
    },
    [file.content, updateCursorTracking]
  );

  // Subscribe to real-time remote CRDT operations
  useEffect(() => {
    const unsubscribe = socketService.onCRDTOps((data) => {
      // Only process updates for this specific file
      if (data.fileId !== activeFileIdRef.current) return;

      const currentSocket = socketService.getSocket();
      // Ignore self echoes
      if (currentSocket && data.authorSocketId === currentSocket.id) return;

      if (!data.ops || data.ops.length === 0) return;

      // 1. Capture current cursor before remote operations merge
      const textarea = textareaRef.current;
      const curStart = textarea ? textarea.selectionStart : selectionRef.current.start;
      const curEnd = textarea ? textarea.selectionEnd : selectionRef.current.end;

      // 2. Apply remote CRDT ops with deterministic ordering & Lamport clock
      const mergeResult = crdtDocRef.current.applyRemoteOps(data.ops);

      // 3. Transform caret position against remote ops: PREVENTS CURSOR JUMPING!
      const newStart = crdtDocRef.current.transformCursor(curStart, data.ops);
      const newEnd = crdtDocRef.current.transformCursor(curEnd, data.ops);

      lastContentRef.current = mergeResult.text;
      selectionRef.current = { start: newStart, end: newEnd };

      // 4. Update textarea value and atomically restore caret
      if (textarea) {
        textarea.value = mergeResult.text;
        textarea.setSelectionRange(newStart, newEnd);
      }

      // 5. Notify parent (isRemoteMerge = true prevents re-broadcasting)
      onCodeChange(mergeResult.text, undefined, true);

      // 6. Update cursor coordinates and sync scroll
      updateCursorTracking();

      if (mergeResult.conflictsResolved > 0) {
        setConflictsResolvedCount((c) => c + mergeResult.conflictsResolved);
      }

      // Show temporary non-intrusive toast notice of concurrent resolution
      setRecentConflictNotice({
        author: data.authorName || "Collaborator",
        timestamp: Date.now(),
        detail: `Merged ${data.ops.length} concurrent ops without cursor jump`,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [onCodeChange, updateCursorTracking]);

  // Auto-dismiss conflict toast after 3.5 seconds
  useEffect(() => {
    if (!recentConflictNotice) return;
    const timer = setTimeout(() => {
      setRecentConflictNotice(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [recentConflictNotice]);

  // Split lines for line numbers
  const lines = useMemo(() => file.content.split("\n"), [file.content]);
  const lineCount = lines.length;

  // Filter collaborators who are viewing THIS specific file
  const fileCollaborators = useMemo(() => {
    return users.filter(
      (u) =>
        u.activeFileId === file.id &&
        (!currentUser || (u.id !== currentUser.id && u.socketId !== currentUser.socketId)) &&
        u.cursor
    );
  }, [users, file.id, currentUser]);

  // Compute visual column taking into account tab characters and 2-space tab stops
  const getVisualColumn = useCallback((lineText: string | undefined, charIndex: number) => {
    if (!lineText) return Math.max(0, charIndex - 1);
    let col = 0;
    const targetIdx = Math.min(Math.max(0, charIndex - 1), lineText.length);
    for (let i = 0; i < targetIdx; i++) {
      if (lineText[i] === "\t") {
        col += 2 - (col % 2);
      } else {
        col += 1;
      }
    }
    return col;
  }, []);

  // Synchronize scroll between textarea, syntax highlight pre, line numbers, and floating cursors
  const handleScroll = useCallback(() => {
    if (!textareaRef.current) return;
    const { scrollTop, scrollLeft } = textareaRef.current;

    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
    if (cursorsLayerRef.current) {
      cursorsLayerRef.current.scrollTop = scrollTop;
      cursorsLayerRef.current.scrollLeft = scrollLeft;
    }
    if (activeLineRef.current) {
      activeLineRef.current.scrollTop = scrollTop;
    }
  }, []);

  // Syntax highlighting via Prism
  const highlightedCode = useMemo(() => {
    let grammar = Prism.languages.javascript;
    if (file.language === "typescript") {
      grammar = Prism.languages.typescript || Prism.languages.javascript;
    } else if (file.language === "python") {
      grammar = Prism.languages.python || Prism.languages.javascript;
    } else if (file.language === "json") {
      grammar = Prism.languages.json || Prism.languages.javascript;
    } else if (file.language === "html") {
      grammar = Prism.languages.html || Prism.languages.markup || Prism.languages.javascript;
    } else if (file.language === "css") {
      grammar = Prism.languages.css || Prism.languages.javascript;
    }

    try {
      return Prism.highlight(file.content, grammar, file.language);
    } catch {
      return file.content;
    }
  }, [file.content, file.language]);

  // Handle textarea keyboard events (Tab indent, shortcuts, cursor changes)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Run shortcut: Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onRunCode();
      return;
    }

    // Save shortcut: Ctrl+S or Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      onSaveCheckpoint();
      return;
    }

    // Prettify shortcut: Shift+Alt+F (VS Code standard) or Cmd/Ctrl+Shift+F
    if (
      (e.shiftKey && e.altKey && (e.key === "f" || e.key === "F")) ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "f" || e.key === "F"))
    ) {
      e.preventDefault();
      handlePrettify();
      return;
    }

    // Tab key indent
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart, selectionEnd, value } = textarea;
      const spaces = "  "; // 2 spaces

      if (e.shiftKey) {
        // Unindent
        const linesBefore = value.substring(0, selectionStart).split("\n");
        const currentLineIdx = linesBefore.length - 1;
        const allLines = value.split("\n");
        if (allLines[currentLineIdx].startsWith("  ")) {
          allLines[currentLineIdx] = allLines[currentLineIdx].slice(2);
          const newContent = allLines.join("\n");
          const ops = crdtDocRef.current.reconcileWithText(newContent);
          lastContentRef.current = newContent;
          onCodeChange(newContent, ops);
          setTimeout(() => {
            textarea.selectionStart = Math.max(0, selectionStart - 2);
            textarea.selectionEnd = Math.max(0, selectionEnd - 2);
            updateCursorTracking();
          }, 0);
        }
      } else {
        // Normal Tab indent
        const newContent = value.substring(0, selectionStart) + spaces + value.substring(selectionEnd);
        const ops = crdtDocRef.current.reconcileWithText(newContent);
        lastContentRef.current = newContent;
        onCodeChange(newContent, ops);
        setTimeout(() => {
          textarea.selectionStart = selectionStart + 2;
          textarea.selectionEnd = selectionStart + 2;
          updateCursorTracking();
        }, 0);
      }
      return;
    }

    // For all other navigation keys (Arrow keys, Home, End, Backspace), update cursor tracking in the next frame
    requestAnimationFrame(() => {
      updateCursorTracking();
    });
  };

  // Local text modification via input: compute minimal CRDT operations and emit
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    lastContentRef.current = newContent;

    // Generate surgical CRDT operations through character diffing
    const ops = crdtDocRef.current.reconcileWithText(newContent);
    onCodeChange(newContent, ops);
    updateCursorTracking();
  };

  // Switch latency simulation
  const handleSetLatency = (ms: number) => {
    setSimulatedLatency(ms);
    socketService.setSimulatedLatency(ms);
  };

  // Trigger synthetic concurrent race edit to demonstrate real-time CRDT merge
  const handleSimulateConcurrentEdit = () => {
    if (!textareaRef.current) return;
    const curLine = cursorPos.line;
    const curCh = cursorPos.ch;

    // Simulate an edit on the line immediately above or below by an AI peer
    const simulatedPeerId = "collab-peer-synthetic";
    const timestampStr = new Date().toLocaleTimeString();
    const concurrentSnippet = `\n// [Concurrent CRDT Sync @ ${timestampStr}] Validated Ln ${curLine}\n`;

    // Reconcile or insert directly into doc as if from socket
    const tempDoc = new TextCRDTDoc(simulatedPeerId, file.content);
    // Find line offset
    const lineOffsets = [0];
    for (let i = 0; i < file.content.length; i++) {
      if (file.content[i] === "\n") lineOffsets.push(i + 1);
    }
    const targetOffset = lineOffsets[Math.min(curLine, lineOffsets.length - 1)] || file.content.length;
    const ops = tempDoc.insert(targetOffset, concurrentSnippet);

    // Apply via CRDT socket pipeline
    socketService.emitCRDTOps(
      roomId,
      file.id,
      ops,
      tempDoc.getText(),
      file.version + 1,
      simulatedPeerId,
      Date.now(),
      "Concurrent Bot"
    );

    // Also trigger locally if self-testing
    const merge = crdtDocRef.current.applyRemoteOps(ops);
    const newStart = crdtDocRef.current.transformCursor(textareaRef.current.selectionStart, ops);
    const newEnd = crdtDocRef.current.transformCursor(textareaRef.current.selectionEnd, ops);

    textareaRef.current.value = merge.text;
    textareaRef.current.setSelectionRange(newStart, newEnd);
    lastContentRef.current = merge.text;
    onCodeChange(merge.text, undefined, true);
    updateCursorTracking();

    setConflictsResolvedCount((c) => c + 1);
    setRecentConflictNotice({
      author: "Concurrent Bot",
      timestamp: Date.now(),
      detail: `Successfully merged simultaneous edit at Ln ${curLine} without moving cursor`,
    });
  };

  // Keep scroll and cursor synchronized on mount and file change
  useEffect(() => {
    handleScroll();
    updateCursorTracking();
  }, [file.id, handleScroll, updateCursorTracking]);

  // Document selection change to track mouse drag selections or navigation
  useEffect(() => {
    const handleSelectionChange = () => {
      if (document.activeElement === textareaRef.current) {
        updateCursorTracking();
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [updateCursorTracking]);

  // Prettify active file handler
  const handlePrettify = useCallback(async () => {
    if (isFormatting || !file) return;
    setIsFormatting(true);

    try {
      const currentCode = textareaRef.current ? textareaRef.current.value : file.content;
      const result = await formatCode(currentCode, file.language);

      if (result.success) {
        if (result.changed && result.formatted !== undefined) {
          const newContent = result.formatted;
          const textarea = textareaRef.current;

          // Reconcile with local CRDT document to generate surgical CRDT operations
          const ops = crdtDocRef.current.reconcileWithText(newContent);
          lastContentRef.current = newContent;

          if (textarea) {
            const prevStart = textarea.selectionStart;
            const prevEnd = textarea.selectionEnd;
            textarea.value = newContent;
            const newStart = Math.min(prevStart, newContent.length);
            const newEnd = Math.min(prevEnd, newContent.length);
            textarea.setSelectionRange(newStart, newEnd);
          }

          onCodeChange(newContent, ops);
          updateCursorTracking();

          setFormatNotice({
            type: "success",
            message: `Formatted ${file.name} (${file.language})`,
            timestamp: Date.now(),
          });
        } else {
          setFormatNotice({
            type: "info",
            message: `Code is already formatted (${file.language})`,
            timestamp: Date.now(),
          });
        }
      } else {
        setFormatNotice({
          type: "error",
          message: result.error ? `${result.error}` : "Formatting failed",
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      setFormatNotice({
        type: "error",
        message: String(err?.message || "Failed to prettify code"),
        timestamp: Date.now(),
      });
    } finally {
      setIsFormatting(false);
    }
  }, [file, isFormatting, onCodeChange, updateCursorTracking]);

  // Expose prettify trigger if parent needs it
  useEffect(() => {
    onRegisterPrettify?.(handlePrettify);
  }, [onRegisterPrettify, handlePrettify]);

  return (
    <div className="flex-1 flex flex-col bg-[#0b0f19] h-full overflow-hidden select-text relative">
      {/* Editor subheader toolbar */}
      <div className="h-9 px-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-slate-200">
            <FileLanguageIcon fileName={file.name} language={file.language} size="xs" />
            <span className="font-semibold">{file.name}</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
            {file.language}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-[11px] text-slate-400">
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* CRDT Conflict Resolution Engine Status Pill */}
          <div className="relative">
            <button
              onClick={() => setIsCrdtMenuOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border font-medium transition cursor-pointer ${
                simulatedLatency > 0
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
              }`}
              title="Click to configure CRDT Conflict Resolution & Latency Simulation"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${simulatedLatency > 0 ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-pulse"}`} />
              <GitMerge className="w-3.5 h-3.5" />
              <span>CRDT RGA</span>
              {simulatedLatency > 0 ? (
                <span className="text-[10px] font-mono px-1 py-0.2 bg-amber-500/20 rounded">
                  +{simulatedLatency}ms
                </span>
              ) : (
                <span className="text-[10px] font-mono opacity-80">Synced</span>
              )}
              {conflictsResolvedCount > 0 && (
                <span className="px-1 py-0.2 rounded-full bg-indigo-500/30 text-indigo-300 text-[9px] font-bold">
                  {conflictsResolvedCount}
                </span>
              )}
              <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
            </button>

            {/* CRDT Diagnostics & Latency Simulation Popover */}
            {isCrdtMenuOpen && (
              <div 
                className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-3 z-50 text-slate-300 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>CRDT Conflict Resolution</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    RGA-Vector
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  Prevents cursor jumping, lost characters, and race conditions by maintaining a Replicated Growable Array with Lamport causality vectors.
                </p>

                {/* Conflict metrics */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-slate-950/70 p-2 rounded border border-slate-800 text-[11px]">
                    <div className="text-slate-500 text-[10px] uppercase font-mono">Resolved Conflicts</div>
                    <div className="text-base font-mono font-bold text-emerald-400 mt-0.5">
                      {conflictsResolvedCount}
                    </div>
                  </div>
                  <div className="bg-slate-950/70 p-2 rounded border border-slate-800 text-[11px]">
                    <div className="text-slate-500 text-[10px] uppercase font-mono">Lamport Clock</div>
                    <div className="text-base font-mono font-bold text-indigo-400 mt-0.5">
                      {crdtDocRef.current.lamportClock}
                    </div>
                  </div>
                </div>

                {/* Latency Simulation Selector */}
                <div className="mb-3">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center justify-between">
                    <span>Simulate High Latency</span>
                    <Wifi className="w-3 h-3 text-slate-500" />
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: "0ms", val: 0 },
                      { label: "350ms", val: 350 },
                      { label: "800ms", val: 800 },
                      { label: "1500ms", val: 1500 },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => handleSetLatency(opt.val)}
                        className={`py-1 text-[11px] font-mono rounded border transition text-center ${
                          simulatedLatency === opt.val
                            ? "bg-indigo-600 border-indigo-500 text-white font-bold"
                            : "bg-slate-950/50 border-slate-800 hover:bg-slate-800 text-slate-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Simulate Concurrent Race Action */}
                <button
                  onClick={handleSimulateConcurrentEdit}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 hover:border-indigo-500/60 rounded text-indigo-300 hover:text-white text-[11px] font-medium transition cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Test Concurrent Race Edit</span>
                </button>
              </div>
            )}
          </div>

          {/* Active collaborator status in editor */}
          {fileCollaborators.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 text-[11px]">
              <span className="text-slate-300 font-medium">Collaborating:</span>
              <div className="flex items-center -space-x-1">
                {fileCollaborators.map((u) => (
                  <span
                    key={u.id}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white border border-slate-900 uppercase"
                    style={{ backgroundColor: u.color }}
                    title={`${u.username} at Ln ${u.cursor?.line}, Col ${u.cursor?.ch}`}
                  >
                    {u.username[0]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cursor position display */}
          <div className="font-mono text-[11px] text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
            Ln {cursorPos.line}, Col {cursorPos.ch}
          </div>

          {/* Prettify Code Button */}
          <button
            id="editor-prettify-button"
            onClick={handlePrettify}
            disabled={isFormatting}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer border ${
              isFormatting
                ? "bg-indigo-950/60 border-indigo-500/40 text-indigo-300 animate-pulse"
                : "bg-slate-800/80 hover:bg-slate-700/90 border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white active:scale-95 shadow-xs"
            }`}
            title="Prettify: Automatically format code based on language (Shift+Alt+F)"
          >
            <Sparkles
              className={`w-3.5 h-3.5 ${
                isFormatting ? "animate-spin text-indigo-400" : "text-amber-400"
              }`}
            />
            <span>{isFormatting ? "Formatting..." : "Prettify"}</span>
            <span className="hidden lg:inline-block text-[9px] font-mono px-1 py-0.2 rounded bg-slate-950/60 text-slate-400 border border-slate-800">
              ⇧⌥F
            </span>
          </button>

          {/* Font Size Selector */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <button
              onClick={() => setFontSize((s) => Math.max(12, s - 1))}
              className="px-1.5 py-0.5 hover:bg-slate-800 rounded text-slate-300 transition cursor-pointer"
              title="Decrease font size"
            >
              A-
            </button>
            <span className="font-mono">{fontSize}px</span>
            <button
              onClick={() => setFontSize((s) => Math.min(20, s + 1))}
              className="px-1.5 py-0.5 hover:bg-slate-800 rounded text-slate-300 transition cursor-pointer"
              title="Increase font size"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* Non-intrusive Conflict Resolution Banner */}
      {recentConflictNotice && (
        <div className="absolute top-10 right-4 z-40 flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 border border-emerald-500/40 rounded-md shadow-xl text-xs text-emerald-300 backdrop-blur-sm animate-in slide-in-from-top-2 duration-150">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-medium">CRDT Merged:</span>
          <span className="text-slate-300 font-mono text-[11px]">{recentConflictNotice.detail}</span>
        </div>
      )}

      {/* Non-intrusive Prettify Status Notification */}
      {formatNotice && (
        <div
          className={`absolute top-10 right-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-md shadow-xl text-xs backdrop-blur-sm border animate-in slide-in-from-top-2 duration-150 ${
            formatNotice.type === "success"
              ? "bg-slate-900/95 border-emerald-500/50 text-emerald-300"
              : formatNotice.type === "info"
              ? "bg-slate-900/95 border-slate-700 text-slate-300"
              : "bg-slate-900/95 border-rose-500/50 text-rose-300"
          }`}
        >
          {formatNotice.type === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
          {formatNotice.type === "info" && <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          {formatNotice.type === "error" && <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
          <span className="font-semibold">
            {formatNotice.type === "success"
              ? "Prettified:"
              : formatNotice.type === "info"
              ? "Prettify:"
              : "Prettify Error:"}
          </span>
          <span className="font-mono text-[11px] max-w-sm truncate">{formatNotice.message}</span>
        </div>
      )}

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Line Numbers Gutter */}
        <div
          ref={lineNumbersRef}
          className="w-12 bg-slate-950/70 border-r border-slate-800/60 select-none py-4 overflow-hidden text-right pr-3 font-mono text-slate-600 text-xs shrink-0"
          style={{
            fontFamily: "'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: `${fontSize}px`,
            lineHeight: `${lineHeight}px`,
          }}
        >
          {lines.map((_, i) => {
            const lineNum = i + 1;
            const isCurrentLine = cursorPos.line === lineNum;
            return (
              <div
                key={i}
                onClick={() => handleLineNumberClick(lineNum)}
                className={`transition-colors cursor-pointer hover:text-indigo-300 ${
                  isCurrentLine ? "text-indigo-400 font-semibold" : "text-slate-600"
                }`}
                style={{
                  height: `${lineHeight}px`,
                  lineHeight: `${lineHeight}px`,
                }}
                title={`Click to select line ${lineNum}`}
              >
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Code Canvas Container */}
        <div className="flex-1 relative overflow-hidden">
          {/* Active Line Background Highlight */}
          <div
            ref={activeLineRef}
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none overflow-hidden"
          >
            <div
              className="absolute left-0 right-0 bg-indigo-500/[0.07] border-y border-indigo-500/20 pointer-events-none transition-all duration-75"
              style={{
                top: `${16 + (cursorPos.line - 1) * lineHeight}px`,
                height: `${lineHeight}px`,
              }}
            />
          </div>

          {/* Syntax Highlighting Layer (No whitespace between pre and code to avoid leading newline shift) */}
          <pre
            ref={preRef}
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none p-4 m-0 font-mono overflow-hidden whitespace-pre tab-2"
            style={{
              fontFamily: "'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: `${fontSize}px`,
              lineHeight: `${lineHeight}px`,
              tabSize: 2,
            }}
          ><code
            dangerouslySetInnerHTML={{ __html: highlightedCode + (file.content.endsWith("\n") ? " " : "") }}
            className={`language-${file.language} block font-mono`}
            style={{
              fontFamily: "inherit",
              fontSize: "inherit",
              lineHeight: "inherit",
              padding: 0,
              margin: 0,
              border: 0,
            }}
          /></pre>

          {/* Remote Collaborators Floating Cursors, Carets & Selections Layer */}
          <div
            ref={cursorsLayerRef}
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none overflow-hidden"
          >
            {/* Remote selection highlights */}
            {fileCollaborators.map((collaborator) => {
              if (!collaborator.selection) return null;
              const sel = collaborator.selection;
              const selElements = [];

              for (let l = sel.startLine; l <= sel.endLine; l++) {
                const lineStr = lines[l - 1] || "";
                let startCol = 0;
                let endCol = lineStr.length;

                if (l === sel.startLine) {
                  startCol = getVisualColumn(lineStr, sel.startCh);
                }
                if (l === sel.endLine) {
                  endCol = getVisualColumn(lineStr, sel.endCh);
                }

                const colDiff = Math.max(1, endCol - startCol);
                const top = 16 + (l - 1) * lineHeight;
                const left = 16 + startCol * charWidth;
                const width = colDiff * charWidth;

                selElements.push(
                  <div
                    key={`sel-${collaborator.id || collaborator.socketId}-l${l}`}
                    className="absolute pointer-events-none rounded-xs"
                    style={{
                      top: `${top}px`,
                      left: `${left}px`,
                      width: `${width}px`,
                      height: `${lineHeight}px`,
                      backgroundColor: `${collaborator.color}35`,
                      borderBottom: `1.5px solid ${collaborator.color}90`,
                    }}
                  />
                );
              }

              return (
                <React.Fragment key={`sel-group-${collaborator.id || collaborator.socketId}`}>
                  {selElements}
                </React.Fragment>
              );
            })}

            {/* Remote Cursors & Caret flags */}
            {fileCollaborators.map((collaborator) => {
              if (!collaborator.cursor) return null;
              const { line, ch } = collaborator.cursor;
              const lineStr = lines[line - 1] || "";
              const visualCol = getVisualColumn(lineStr, ch);

              // Compute top & left precisely aligned with text coordinates
              const top = 16 + (line - 1) * lineHeight;
              const left = 16 + visualCol * charWidth;

              return (
                <div
                  key={collaborator.id || collaborator.socketId}
                  className="absolute pointer-events-none transition-all duration-75 z-20"
                  style={{ top: `${top}px`, left: `${left}px` }}
                >
                  {/* Floating User Name Flag */}
                  <div
                    className="absolute -top-5 left-0 flex items-center gap-1 text-[10px] font-semibold text-white px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap z-30 pointer-events-none"
                    style={{ backgroundColor: collaborator.color }}
                  >
                    <span>{collaborator.username}</span>
                  </div>

                  {/* Vertical Caret Bar */}
                  <div
                    className="w-[2px] animate-cursor-blink shadow-sm"
                    style={{
                      height: `${lineHeight}px`,
                      backgroundColor: collaborator.color,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Main Interactive Textarea */}
          <textarea
            ref={textareaRef}
            id="collaborative-editor-textarea"
            value={file.content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onKeyUp={updateCursorTracking}
            onClick={updateCursorTracking}
            onSelect={updateCursorTracking}
            onFocus={updateCursorTracking}
            onScroll={handleScroll}
            wrap="off"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="absolute inset-0 w-full h-full p-4 m-0 font-mono resize-none outline-none border-none bg-transparent whitespace-pre overflow-auto tab-2 z-10"
            style={{
              fontFamily: "'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: `${fontSize}px`,
              lineHeight: `${lineHeight}px`,
              tabSize: 2,
            }}
          />
        </div>
      </div>
    </div>
  );
};
