/* eslint-disable react-hooks/immutability */
"use client";

import { useState, useEffect } from "react";
import {
  submitIngest,
  pruneMemory,
  executeMitigation,
  fetchDecayStats,
  uploadFileIngestion,
  DecayStats,
} from "@/lib/api";
import {
  Database,
  PlusCircle,
  RefreshCw,
  Trash2,
  Heart,
  Activity,
  ArrowRight,
  Terminal,
  Loader2,
  FileUp,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface IncidentControlProps {
  onRefresh: () => void;
  nodeCount: number;
  linkCount: number;
}

export default function IncidentControl({
  onRefresh,
  nodeCount,
  linkCount,
}: IncidentControlProps) {
  const [ingestText, setIngestText] = useState("");
  const [nodeSetInput, setNodeSetInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isPopulating, setIsPopulating] = useState(false);
  const [decayStats, setDecayStats] = useState<DecayStats | null>(null);

  useEffect(() => {
    loadDecayStats();
  }, [nodeCount]);

  const loadDecayStats = async () => {
    try {
      const stats = await fetchDecayStats("incidents");
      setDecayStats(stats);
    } catch {
      // Decay stats are non-critical
    }
  };

  const handleIngest = async (textToIngest?: string) => {
    const text = textToIngest || ingestText;
    if (!text.trim()) return;
    setIsIngesting(true);
    const nodeSet = nodeSetInput.trim()
      ? nodeSetInput.split(",").map((s) => s.trim())
      : undefined;
    try {
      toast.info("Running custom ingestion cognitive pipeline...");
      await submitIngest(text, "incidents", nodeSet);
      if (!textToIngest) setIngestText("");
      toast.success("Telemetry successfully ingested and graph updated!");
      onRefresh();
      loadDecayStats();
    } catch (e: unknown) {
      toast.error(
        `Ingestion error: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsIngesting(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      toast.info(`Uploading and parsing ${selectedFile.name}...`);
      await uploadFileIngestion(
        selectedFile,
        "incidents",
        nodeSetInput.trim() || undefined,
      );
      toast.success("File ingested into knowledge graph successfully!");
      setSelectedFile(null);
      onRefresh();
      loadDecayStats();
    } catch (e: unknown) {
      toast.error(
        `File upload error: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = async () => {
    if (
      !confirm(
        "Are you sure you want to prune and reset all memory graph databases?",
      )
    )
      return;
    setIsResetting(true);
    try {
      toast.info("Pruning and resetting memory graph...");
      await pruneMemory();
      toast.success("Memory graph reset successfully!");
      onRefresh();
      setDecayStats(null);
    } catch (e: unknown) {
      toast.error(`Reset error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleLoadMockData = async () => {
    setIsPopulating(true);
    try {
      toast.info("Seeding graph database with mock data script...");
      await executeMitigation("python3 scripts/populate_graph.py");
      toast.success("Sample dataset seeded successfully!");
      onRefresh();
      loadDecayStats();
    } catch (e: unknown) {
      toast.error(
        `Error loading mock data: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsPopulating(false);
    }
  };

  const handleScenario = (text: string) => {
    handleIngest(text);
  };

  const decayPct = decayStats?.decay_percentage ?? 0;
  const healthPct =
    nodeCount > 0
      ? Math.round(
          ((nodeCount - (decayStats?.stale_nodes ?? 0)) / nodeCount) * 100,
        )
      : 98;

  return (
    <div className="flex flex-col h-full bg-[#faf9f5] border border-[#e6dfd8]/80 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-[#e6dfd8]/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#efe9de] rounded-lg">
            <Database className="w-4 h-4 text-[#141413]" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wider text-[#141413] uppercase font-mono">
              Telemetry Ingest Engine
            </h2>
            <p className="text-[10px] text-[#6c6a64] font-mono">
              ITIL ONTOLOGY MAPPER V2
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-[#efe9de] text-[#3d3d3a] px-2 py-0.5 rounded-full border border-[#e6dfd8] font-mono text-[9px] font-semibold">
          <span className="w-1 h-1 bg-[#5db872] rounded-full" />
          <span>ON-LINE</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#f5f0e8] border border-[#e6dfd8] rounded-xl p-4 transition-all duration-200 hover:bg-[#efe9de] cursor-pointer shadow-sm">
              <div className="text-2xl font-bold text-[#141413] font-mono">
                {nodeCount}
              </div>
              <div className="text-[10px] text-[#6c6a64] font-mono uppercase tracking-widest font-semibold mt-1">
                Graph Entities
              </div>
            </div>
            <div className="bg-[#f5f0e8] border border-[#e6dfd8] rounded-xl p-4 transition-all duration-200 hover:bg-[#efe9de] cursor-pointer shadow-sm">
              <div className="text-2xl font-bold text-[#141413] font-mono">
                {linkCount}
              </div>
              <div className="text-[10px] text-[#6c6a64] font-mono uppercase tracking-widest font-semibold mt-1">
                Ontology Edges
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-[#f5f0e8] border border-[#e6dfd8] rounded-xl p-4 text-xs font-mono">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[#6c6a64]">
                <span className="flex items-center gap-1.5 font-medium">
                  <Heart className="w-3.5 h-3.5 text-[#5db872]" /> Graph
                  Consensus
                </span>
                <span className="text-[#141413] font-bold font-mono">
                  {healthPct}%
                </span>
              </div>
              <div className="w-full bg-[#e6dfd8] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-linear-to-r from-[#5db872] to-[#5db8a6] h-full transition-all duration-500"
                  style={{ width: `${healthPct}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[#6c6a64]">
                <span className="flex items-center gap-1.5 font-medium">
                  <Activity className="w-3.5 h-3.5 text-[#e8a55a]" /> Knowledge
                  Decay Index
                </span>
                <span className="text-[#141413] font-bold font-mono">
                  {decayPct}%
                </span>
              </div>
              <div className="w-full bg-[#e6dfd8] h-1.5 rounded-full overflow-hidden">
                <div
                  className={`bg-linear-to-r ${
                    decayPct < 5
                      ? "from-[#5db872] to-[#5db8a6]"
                      : decayPct < 15
                        ? "from-[#e8a55a] to-[#d4a017]"
                        : "from-[#c64545] to-[#a33]"
                  } h-full transition-all duration-500`}
                  style={{ width: `${Math.min(decayPct, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#e6dfd8] pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-mono text-[#6c6a64] uppercase tracking-widest">
              Ingest Raw Incident Stream
            </h3>
            <span className="text-[10px] font-mono text-[#6c6a64] flex items-center gap-1">
              <Terminal className="w-3 h-3" /> Multi-line logs supported
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-[#6c6a64]" />
              <input
                type="text"
                placeholder="Optional NodeSets (comma-separated, e.g. production, us-east-1, outage-2026)"
                value={nodeSetInput}
                onChange={(e) => setNodeSetInput(e.target.value)}
                className="w-full bg-[#faf9f5] border border-[#e6dfd8] focus:border-[#cc785c]/80 rounded-lg px-3 py-1.5 text-xs text-[#141413] placeholder-[#8e8b82] font-mono focus:outline-none focus:ring-2 focus:ring-[#cc785c]/10"
              />
            </div>
            <div className="relative group">
              <textarea
                rows={8}
                placeholder="Paste raw Slack outage transcripts, Kubernetes CLI stack traces, runbook Markdown definitions, or ADR texts here..."
                value={ingestText}
                onChange={(e) => setIngestText(e.target.value)}
                className="w-full bg-[#faf9f5] border border-[#e6dfd8] focus:border-[#cc785c]/80 rounded-xl p-3.5 text-xs text-[#141413] placeholder-[#8e8b82] font-mono focus:outline-none focus:ring-4 focus:ring-[#cc785c]/5 transition-all duration-300 shadow-inner leading-relaxed resize-none"
              />
              <div className="absolute bottom-3 right-3 text-[10px] font-mono text-[#8e8b82]">
                {ingestText.length} chars
              </div>
            </div>
            <Button
              onClick={() => handleIngest()}
              disabled={isIngesting || !ingestText.trim()}
              className="w-full gap-2 bg-[#cc785c] hover:bg-[#a9583e] active:bg-[#8e4731] text-white font-mono text-xs font-semibold py-2.5 shadow-sm"
            >
              {isIngesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Running 8-Task Custom Pipeline...
                </>
              ) : (
                <>
                  <PlusCircle className="w-3.5 h-3.5" />
                  Ingest Telemetry
                </>
              )}
            </Button>
            {isIngesting && (
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#6c6a64] mt-1">
                <span className="animate-pulse">normalize</span>
                <span>&rarr;</span>
                <span
                  className="animate-pulse"
                  style={{ animationDelay: "0.1s" }}
                >
                  extract
                </span>
                <span>&rarr;</span>
                <span
                  className="animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                >
                  temporal
                </span>
                <span>&rarr;</span>
                <span
                  className="animate-pulse"
                  style={{ animationDelay: "0.3s" }}
                >
                  ontology
                </span>
                <span>&rarr;</span>
                <span
                  className="animate-pulse"
                  style={{ animationDelay: "0.4s" }}
                >
                  dependencies
                </span>
                <span>&rarr;</span>
                <span
                  className="animate-pulse"
                  style={{ animationDelay: "0.5s" }}
                >
                  link
                </span>
                <span>&rarr;</span>
                <span
                  className="animate-pulse"
                  style={{ animationDelay: "0.6s" }}
                >
                  provenance
                </span>
                <span>&rarr;</span>
                <span
                  className="animate-pulse"
                  style={{ animationDelay: "0.7s" }}
                >
                  store
                </span>
              </div>
            )}

            <div className="pt-4 border-t border-[#e6dfd8]/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-[#6c6a64] uppercase tracking-widest flex items-center gap-1.5">
                  <FileUp className="w-3.5 h-3.5 text-[#cc785c]" /> Upload
                  Document / PDF / Markdown
                </span>
                <span className="text-[10px] font-mono text-[#8e8b82]">
                  Max 500KB
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".pdf,.md,.txt"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="flex-1 text-xs font-mono text-[#6c6a64] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#efe9de] file:text-[#141413] hover:file:bg-[#e6dfd8] cursor-pointer"
                />
                <Button
                  onClick={handleFileUpload}
                  disabled={isUploading || !selectedFile}
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs border-[#cc785c]/40 text-[#cc785c] hover:bg-[#cc785c]/10 shrink-0 gap-1.5 shadow-xs"
                >
                  {isUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileUp className="w-3.5 h-3.5" />
                  )}
                  {isUploading ? "Ingesting..." : "Upload & Ingest"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#e6dfd8] pt-6 space-y-3.5">
          <h3 className="text-xs font-bold font-mono text-[#6c6a64] uppercase tracking-widest">
            SRE Outage Templates
          </h3>
          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={() =>
                handleScenario(
                  "Alert DB-Connection-Limit exceeded 98% was triggered on User-DB at 2026-06-22T12:00:00Z. User-DB is owned by the User-Data team. Alert is caused by User-Gateway query spike.",
                )
              }
              className="group text-left bg-[#f5f0e8] border border-[#e6dfd8]/80 hover:border-[#cc785c]/40 hover:bg-[#efe9de] text-[#3d3d3a] text-xs p-3.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="font-semibold font-mono text-[9px] text-[#5db8a6] tracking-wider uppercase bg-[#efe9de] border border-[#e6dfd8] px-1.5 py-0.5 rounded-md inline-block">
                  Simulate Live Alert
                </div>
                <div className="text-[#141413] font-semibold">
                  DB-Connection-Limit Exceeded on User-DB
                </div>
                <div className="text-[10px] text-[#6c6a64] font-mono">
                  Triggers cascaded connection thresholds
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#8e8b82] group-hover:text-[#cc785c] group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() =>
                handleScenario(
                  "Incident Incident-303 occurred at 2026-06-21T09:00:00Z. User-Gateway experienced OOM errors. SRE resolved the issue by executing python3 scripts/restart_service.py user-gateway which restored service. Efficacy: 1.0.",
                )
              }
              className="group text-left bg-[#f5f0e8] border border-[#e6dfd8]/80 hover:border-[#cc785c]/40 hover:bg-[#efe9de] text-[#3d3d3a] text-xs p-3.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="font-semibold font-mono text-[9px] text-[#cc785c] tracking-wider uppercase bg-[#efe9de] border border-[#e6dfd8] px-1.5 py-0.5 rounded-md inline-block">
                  Simulate Post-Mortem
                </div>
                <div className="text-[#141413] font-semibold">
                  User-Gateway OOM Restart Mitigation
                </div>
                <div className="text-[10px] text-[#6c6a64] font-mono">
                  Ingests runbook scripts and efficacy loops
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#8e8b82] group-hover:text-[#cc785c] group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-[#e6dfd8] bg-[#f5f0e8] flex gap-3">
        <Button
          onClick={handleLoadMockData}
          disabled={isPopulating}
          variant="outline"
          size="sm"
          className="flex-1 font-mono text-xs font-semibold border-[#e6dfd8] text-[#3d3d3a] hover:bg-[#efe9de]"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isPopulating ? "animate-spin" : ""}`}
          />
          {isPopulating ? "Seeding Graph..." : "Load Full Sample Dataset"}
        </Button>
        <Button
          onClick={handleReset}
          disabled={isResetting}
          variant="outline"
          size="sm"
          className="border-[#c64545]/40 text-[#c64545] hover:bg-[#c64545]/10 hover:border-[#c64545]/60"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
