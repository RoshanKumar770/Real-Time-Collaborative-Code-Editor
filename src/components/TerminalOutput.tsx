import React, { useState } from "react";
import { 
  Terminal, 
  Sparkles, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  CheckCircle2, 
  AlertTriangle, 
  Info,
  Clock,
  Gauge
} from "lucide-react";
import { ExecutionResult, CodeAnalysis } from "../types";

interface TerminalOutputProps {
  executionResult: ExecutionResult | null;
  codeAnalysis: CodeAnalysis | null;
  isRunning: boolean;
  isAnalyzing: boolean;
  onClearOutput: () => void;
  onTriggerAnalysis: () => void;
}

export const TerminalOutput: React.FC<TerminalOutputProps> = ({
  executionResult,
  codeAnalysis,
  isRunning,
  isAnalyzing,
  onClearOutput,
  onTriggerAnalysis,
}) => {
  const [activeTab, setActiveTab] = useState<"terminal" | "analyzer">("terminal");
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`bg-slate-950 border-t border-slate-800 flex flex-col transition-all duration-200 ${
      isCollapsed ? "h-9" : "h-64"
    }`}>
      {/* Terminal Title Bar */}
      <div className="h-9 px-4 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setActiveTab("terminal");
              setIsCollapsed(false);
            }}
            className={`flex items-center gap-1.5 font-medium transition cursor-pointer ${
              activeTab === "terminal" && !isCollapsed
                ? "text-indigo-400 border-b-2 border-indigo-500 pb-1"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Execution Console</span>
            {executionResult && (
              <span className={`w-2 h-2 rounded-full ${executionResult.exitCode === 0 ? "bg-emerald-400" : "bg-red-400"}`} />
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab("analyzer");
              setIsCollapsed(false);
              if (!codeAnalysis) onTriggerAnalysis();
            }}
            className={`flex items-center gap-1.5 font-medium transition cursor-pointer ${
              activeTab === "analyzer" && !isCollapsed
                ? "text-indigo-400 border-b-2 border-indigo-500 pb-1"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Code Inspector & Health</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "terminal" && executionResult && (
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3 text-slate-500" />
                {executionResult.executionTimeMs}ms
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  executionResult.exitCode === 0
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-red-500/20 text-red-300"
                }`}
              >
                EXIT {executionResult.exitCode}
              </span>
            </div>
          )}

          {activeTab === "analyzer" && (
            <button
              onClick={onTriggerAnalysis}
              disabled={isAnalyzing}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
            >
              {isAnalyzing ? "Inspecting..." : "Re-Analyze"}
            </button>
          )}

          {activeTab === "terminal" && (
            <button
              onClick={onClearOutput}
              className="text-slate-500 hover:text-slate-300 p-1 rounded transition"
              title="Clear Console"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded transition"
            title={isCollapsed ? "Expand Terminal" : "Collapse Terminal"}
          >
            {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Terminal Content Area */}
      {!isCollapsed && (
        <div className="flex-1 overflow-auto p-4 font-mono text-xs select-text">
          {activeTab === "terminal" ? (
            <div>
              {isRunning ? (
                <div className="text-indigo-400 animate-pulse flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  Executing code in Node.js backend environment...
                </div>
              ) : !executionResult ? (
                <div className="text-slate-600 italic">
                  Press "Run" (or Ctrl + Enter) to execute the active file. Output logs, results, and timing metrics will appear here.
                </div>
              ) : (
                <div className="space-y-2">
                  {executionResult.stdout && (
                    <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {executionResult.stdout}
                    </div>
                  )}

                  {executionResult.stderr && (
                    <div className="text-rose-400 bg-rose-950/20 border-l-2 border-rose-500 pl-3 py-1 whitespace-pre-wrap">
                      {executionResult.stderr}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              {isAnalyzing ? (
                <div className="text-indigo-400 animate-pulse">
                  Analyzing syntax, complexity, and bracket pairing...
                </div>
              ) : !codeAnalysis ? (
                <div className="text-slate-500">Click "Re-Analyze" to inspect active file.</div>
              ) : (
                <div className="space-y-4 font-sans">
                  {/* Top Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                      <div className="text-[11px] text-slate-400">Total Lines</div>
                      <div className="text-lg font-bold text-slate-100 font-mono">
                        {codeAnalysis.lineCount}
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                      <div className="text-[11px] text-slate-400">Token Count</div>
                      <div className="text-lg font-bold text-slate-100 font-mono">
                        {codeAnalysis.tokenCount}
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                      <div className="text-[11px] text-slate-400">Complexity</div>
                      <div className={`text-base font-bold ${
                        codeAnalysis.estimatedComplexity === "High"
                          ? "text-rose-400"
                          : codeAnalysis.estimatedComplexity === "Medium"
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}>
                        {codeAnalysis.estimatedComplexity}
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                      <div className="text-[11px] text-slate-400">Syntax Balance</div>
                      <div className={`text-sm font-bold flex items-center gap-1 mt-1 ${
                        codeAnalysis.syntaxValid ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {codeAnalysis.syntaxValid ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Valid
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Issues Detected
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Diagnostics List */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 mb-2">Code Diagnostics</h4>
                    {codeAnalysis.diagnostics.length === 0 ? (
                      <p className="text-xs text-slate-500">No warnings or syntax errors detected.</p>
                    ) : (
                      <div className="space-y-1.5 font-mono text-xs">
                        {codeAnalysis.diagnostics.map((diag, index) => (
                          <div
                            key={index}
                            className={`p-2 rounded flex items-start gap-2 ${
                              diag.severity === "error"
                                ? "bg-rose-950/30 text-rose-300 border border-rose-900/50"
                                : diag.severity === "warning"
                                ? "bg-amber-950/30 text-amber-300 border border-amber-900/50"
                                : "bg-slate-900 text-slate-300 border border-slate-800"
                            }`}
                          >
                            <span className="text-slate-500 select-none">Line {diag.line}:</span>
                            <span className="flex-1">{diag.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
