"use client";

import { useState } from "react";
import { GraphNode, MitigationResponse, exportMemoryData, summarizeIncident, updateMemoryEntry, pushToDataset } from "@/lib/api";
import {
  Play,
  ShieldAlert,
  Cpu,
  Database,
  Activity,
  Trash2,
  Radio,
  Download,
  FileText,
  Loader2,
  Edit3,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface InspectorPanelProps {
  selectedNode: GraphNode | null;
  mitigationProposal: { description: string; command: string } | null;
  onExecuteCommand: (command: string) => void;
  executionResult: MitigationResponse | null;
  isExecuting: boolean;
  onForgetNode?: (nodeId: string) => void;
  onToggleOutageSimulation?: (nodeId: string) => void;
  isOutageSimulated?: boolean;
}

export default function InspectorPanel({
  selectedNode,
  mitigationProposal,
  onExecuteCommand,
  executionResult,
  isExecuting,
  onForgetNode,
  onToggleOutageSimulation,
  isOutageSimulated,
}: InspectorPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await exportMemoryData("incidents");
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memops-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Memory graph exported successfully");
    } catch (e: unknown) {
      toast.error(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSummarize = async () => {
    if (!selectedNode) return;
    setIsSummarizing(true);
    setSummary(null);
    try {
      const attrs = selectedNode.attributes || {};
      const text = attrs.raw_text || attrs.description || selectedNode.name || "";
      const res = await summarizeIncident(text, selectedNode.name);
      setSummary(res.summary || res.result || JSON.stringify(res));
      toast.success("Incident summarized");
    } catch (e: unknown) {
      toast.error(`Summarize failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSummarizing(false);
    }
  };
  const getIcon = (type?: string) => {
    switch (type) {
      case "Incident":
      case "Alert":
        return <ShieldAlert className="w-5 h-5 text-[#c64545]" />;
      case "Mitigation":
        return <Cpu className="w-5 h-5 text-[#cc785c]" />;
      case "Service":
        return <Database className="w-5 h-5 text-[#5db872]" />;
      default:
        return <Activity className="w-5 h-5 text-[#e8a55a]" />;
    }
  };

  const type =
    selectedNode?.type || selectedNode?.attributes?.type || "Unknown";
  const name =
    selectedNode?.name ||
    selectedNode?.attributes?.name ||
    selectedNode?.id ||
    "N/A";
  const desc =
    selectedNode?.description || selectedNode?.attributes?.description || "";
  const attributes = selectedNode?.attributes || selectedNode || {};

  return (
    <div className="flex flex-col h-full bg-[#faf9f5] border border-[#e6dfd8] rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b border-[#e6dfd8] bg-[#f5f0e8] flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wider text-[#141413] uppercase font-mono">
          Inspector Trace
        </h2>
        {selectedNode && (
          <span className="text-[10px] bg-[#efe9de] text-[#3d3d3a] border border-[#e6dfd8] font-mono px-2 py-0.5 rounded uppercase">
            {type}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {selectedNode ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              {getIcon(type)}
              <div>
                <h3 className="text-base font-bold text-[#141413]">{name}</h3>
                <span className="text-xs font-mono text-[#6c6a64]">
                  {selectedNode.id}
                </span>
              </div>
            </div>

            {desc && (
              <p className="text-sm text-[#3d3d3a] leading-relaxed">{desc}</p>
            )}

            <div className="border-t border-[#e6dfd8] pt-4">
              <h4 className="text-xs font-mono text-[#6c6a64] uppercase tracking-wider mb-2">
                Properties
              </h4>
              <div className="bg-[#f5f0e8] border border-[#e6dfd8] rounded p-3 space-y-2 max-h-[220px] overflow-y-auto font-mono text-xs text-[#3d3d3a]">
                {Object.entries(attributes).map(([key, val]) => {
                  if (
                    [
                      "id",
                      "type",
                      "name",
                      "description",
                      "vx",
                      "vy",
                      "vz",
                      "x",
                      "y",
                      "z",
                      "index",
                      "fx",
                      "fy",
                      "fz",
                    ].includes(key) ||
                    key.startsWith("__")
                  ) {
                    return null;
                  }
                  return (
                    <div
                      key={key}
                      className="flex justify-between border-b border-[#e6dfd8] pb-1.5 last:border-0 last:pb-0"
                    >
                      <span className="text-[#6c6a64] pr-4">{key}</span>
                      <span className="text-[#141413] text-right break-all">
                        {typeof val === "object"
                          ? JSON.stringify(val)
                          : String(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cognitive Operations Buttons */}
            <div className="flex flex-col gap-2 pt-4 border-t border-[#e6dfd8]">
              {type === "Service" && onToggleOutageSimulation && (
                <Button
                  onClick={() => onToggleOutageSimulation(selectedNode.id)}
                  variant="outline"
                  className={`w-full gap-2 font-mono text-xs shadow-sm border-[#e6dfd8] ${
                    isOutageSimulated
                      ? "bg-[#c64545]/10 text-[#c64545] border-[#c64545]/40 hover:bg-[#c64545]/20 animate-pulse"
                      : "text-[#3d3d3a] hover:bg-[#efe9de]"
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  {isOutageSimulated
                    ? "Stop Outage Simulation"
                    : "Simulate Outage"}
                </Button>
              )}

              {onForgetNode && (
                <Button
                  onClick={() => {
                    if (
                      confirm(
                        `Prune "${name}" from Cognee memory? This cannot be undone.`,
                      )
                    ) {
                      onForgetNode(selectedNode.id);
                    }
                  }}
                  variant="outline"
                  className="w-full gap-2 text-[#c64545] border-[#c64545]/25 hover:bg-[#c64545]/10 hover:border-[#c64545]/50 font-mono text-xs shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Prune from Cognee
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-[#6c6a64] text-center font-mono text-xs">
            <Activity className="w-8 h-8 mb-2 opacity-30" />
            <span>Select a graph node to inspect dependencies</span>
          </div>
        )}

        {(mitigationProposal || (selectedNode && type === "Mitigation")) && (
          <div className="border-t border-[#e6dfd8] pt-6 space-y-3">
            <div className="flex items-center gap-2 text-[#cc785c]">
              <Cpu className="w-4 h-4" />
              <h3 className="text-xs font-mono uppercase tracking-wider">
                Proposed Mitigation
              </h3>
            </div>

            <div className="bg-[#f5f0e8] border border-[#e6dfd8]/60 rounded p-4 space-y-3">
              <div className="text-xs text-[#3d3d3a] font-sans">
                {mitigationProposal?.description ||
                  desc ||
                  "Run self-healing script"}
              </div>
              <div className="bg-[#181715] border border-[#252320] rounded p-2 text-xs font-mono text-[#a09d96] break-all select-all">
                {mitigationProposal?.command ||
                  attributes.command_to_run ||
                  "python3 scripts/restart_service.py"}
              </div>
              <Button
                onClick={() =>
                  onExecuteCommand(
                    mitigationProposal?.command ||
                      attributes.command_to_run ||
                      "python3 scripts/restart_service.py",
                  )
                }
                disabled={isExecuting}
                className="w-full gap-2 bg-[#cc785c] hover:bg-[#a9583e] active:bg-[#8e4731] text-white font-mono text-xs shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                {isExecuting ? "Executing Mitigation..." : "Run Command"}
              </Button>
            </div>
          </div>
        )}

        {executionResult && (
          <div className="border-t border-[#e6dfd8] pt-6 space-y-2">
            <h4 className="text-xs font-mono text-[#6c6a64] uppercase tracking-wider">
              Execution Terminal
            </h4>
            <div className="bg-[#181715] border border-[#252320] rounded p-3 font-mono text-[11px] space-y-2 max-h-[220px] overflow-y-auto">
              <div className="flex justify-between text-[#6c6a64]">
                <span>Status:</span>
                <span
                  className={
                    executionResult.status === "success"
                      ? "text-[#5db872]"
                      : "text-[#c64545]"
                  }
                >
                  {executionResult.status.toUpperCase()} (Exit:{" "}
                  {executionResult.exit_code})
                </span>
              </div>
              {executionResult.stdout && (
                <div className="space-y-1">
                  <div className="text-[#6c6a64]">STDOUT:</div>
                  <pre className="text-[#a09d96] whitespace-pre-wrap">
                    {executionResult.stdout}
                  </pre>
                </div>
              )}
              {executionResult.stderr && (
                <div className="space-y-1">
                  <div className="text-[#6c6a64]">STDERR:</div>
                  <pre className="text-[#c64545] whitespace-pre-wrap">
                    {executionResult.stderr}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedNode && (
          <div className="border-t border-[#e6dfd8] pt-4 space-y-2">
            <h4 className="text-xs font-mono text-[#6c6a64] uppercase tracking-wider">
              Node Actions
            </h4>
            <div className="flex gap-2">
              <Button
                onClick={handleExport}
                disabled={isExporting}
                variant="outline"
                size="sm"
                className="font-mono text-[10px] border-[#e6dfd8] text-[#3d3d3a] hover:bg-[#f5f0e8] gap-1.5"
              >
                {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                Export Graph
              </Button>
              <Button
                onClick={handleSummarize}
                disabled={isSummarizing}
                variant="outline"
                size="sm"
                className="font-mono text-[10px] border-[#e6dfd8] text-[#3d3d3a] hover:bg-[#f5f0e8] gap-1.5"
              >
                {isSummarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                Summarize
              </Button>
            </div>
            {summary && (
              <div className="bg-[#f5f0e8] border border-[#e6dfd8] rounded p-3 text-xs text-[#3d3d3a] font-mono">
                {summary}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
