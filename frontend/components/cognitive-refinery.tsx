"use client";

import { useState } from "react";
import {
  runImprovement,
  fetchImproveHistory,
  fetchGrowthHistory,
  ImproveResponse,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BrainCircuit,
  RefreshCw,
  GitMerge,
  CheckCircle,
  DatabaseZap,
  History,
  TrendingUp,
} from "lucide-react";

interface HistoryData {
  total_runs?: number;
  improve_runs?: Array<{ timestamp: string; dataset: string }>;
}

interface GrowthData {
  total_snapshots?: number;
  growth_rate?: number;
}

export default function CognitiveRefinery() {
  const [isImproving, setIsImproving] = useState(false);
  const [result, setResult] = useState<ImproveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [growthData, setGrowthData] = useState<GrowthData | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const handleRunEvolution = async () => {
    setIsImproving(true);
    setResult(null);
    setError(null);
    try {
      toast.info("Running cognitive refinery evolution pipeline...");
      const res = await runImprovement("incidents");
      setResult(res);
      toast.success("Graph evolution completed successfully!");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to run memory evolution";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsImproving(false);
    }
  };

  const handleFetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      toast.info("Querying evolution & growth telemetry...");
      const [imp, grw] = await Promise.all([
        fetchImproveHistory(20),
        fetchGrowthHistory("incidents"),
      ]);
      setHistoryData(imp);
      setGrowthData(grw);
      toast.success("Telemetry loaded successfully!");
    } catch (e: unknown) {
      toast.error(
        `Failed to load history: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 p-6">
      <div className="bg-[#141413] text-[#faf9f5] rounded-xl p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-[#cc785c] rounded-full mix-blend-screen filter blur-[80px] opacity-20 animate-pulse" />

        <div className="flex items-start justify-between relative z-10">
          <div>
            <h2 className="text-2xl font-bold font-heading tracking-tight mb-2 flex items-center gap-3">
              <BrainCircuit className="w-8 h-8 text-[#cc785c]" />
              Cognitive Refinery
            </h2>
            <p className="text-[#a09d96] text-sm max-w-xl">
              This console triggers Cognee&apos;s{" "}
              <span className="font-mono text-[#cc785c]">improve()</span>{" "}
              pipeline. It consolidates fragmented memory entities, applies
              engineer feedback to re-weight graph edges, and permanently
              bridges session learnings into institutional knowledge.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 items-end">
            <Button
              onClick={handleRunEvolution}
              disabled={isImproving}
              className="bg-[#cc785c] hover:bg-[#a9583e] text-white shadow-lg border border-[#e8a55a]/30 w-full"
            >
              {isImproving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Evolving Graph...
                </>
              ) : (
                <>
                  <DatabaseZap className="w-4 h-4 mr-2" />
                  Run Memory Evolution
                </>
              )}
            </Button>
            <Button
              onClick={handleFetchHistory}
              disabled={isLoadingHistory}
              variant="outline"
              className="bg-[#1e1d1b] border-[#3d3d3a] text-[#a09d96] hover:text-white hover:bg-[#252320] text-xs font-mono w-full"
            >
              <History className="w-3.5 h-3.5 mr-1.5" />
              {isLoadingHistory ? "Loading..." : "Evolution & Growth Logs"}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-[#c64545]/10 border border-[#c64545]/30 text-[#c64545] p-4 rounded-lg text-sm font-mono">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-[#faf9f5] border border-[#5db872]/40 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-[#5db872]">
            <CheckCircle className="w-6 h-6" />
            <h3 className="font-bold text-lg">Evolution Cycle Complete</h3>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-[#f5f0e8] rounded-md p-4 border border-[#e6dfd8]">
              <div className="text-xs font-mono text-[#6c6a64] uppercase tracking-wider mb-2">
                Operation Status
              </div>
              <div className="text-[#141413] font-medium">{result.status}</div>
            </div>
            <div className="bg-[#f5f0e8] rounded-md p-4 border border-[#e6dfd8]">
              <div className="text-xs font-mono text-[#6c6a64] uppercase tracking-wider mb-2">
                Global Context Index
              </div>
              <div className="text-[#141413] font-medium">
                {result.global_context_index ? "Rebuilt" : "Skipped"}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-[#e6dfd8] pt-6">
            <h4 className="text-sm font-bold text-[#141413] mb-3 flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-[#cc785c]" />
              Graph Optimizations Applied
            </h4>
            <ul className="space-y-2 text-sm text-[#3d3d3a]">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#cc785c]" />
                Consolidated fragmented entities into master nodes
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#cc785c]" />
                Re-weighted graph edges based on SRE session feedback
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#cc785c]" />
                Bridged recent investigation sessions into permanent graph
                memory
              </li>
            </ul>
            <p className="text-[10px] text-[#6c6a64] mt-3 font-mono">
              Optimization details are logged server-side. Run /health to
              inspect graph changes.
            </p>
          </div>
        </div>
      )}

      {(historyData || growthData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {historyData && (
            <div className="bg-[#faf9f5] border border-[#e6dfd8] rounded-lg p-5 shadow-sm space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 font-bold text-[#141413] border-b border-[#e6dfd8] pb-2 uppercase">
                <History className="w-4 h-4 text-[#cc785c]" />
                Evolution History ({historyData.total_runs || 0} cycles)
              </div>
              <div className="max-h-[160px] overflow-y-auto space-y-2 text-[#3d3d3a]">
                {historyData.improve_runs &&
                historyData.improve_runs.length > 0 ? (
                  historyData.improve_runs.map((h, idx) => (
                    <div
                      key={idx}
                      className="bg-[#f5f0e8] p-2 rounded border border-[#e6dfd8] flex justify-between"
                    >
                      <span>{h.timestamp?.substring(0, 19)}</span>
                      <span className="font-semibold text-[#5db872]">
                        COMPLETED ({h.dataset})
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-[#6c6a64] italic">
                    No prior evolution cycles recorded.
                  </div>
                )}
              </div>
            </div>
          )}

          {growthData && (
            <div className="bg-[#faf9f5] border border-[#e6dfd8] rounded-lg p-5 shadow-sm space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 font-bold text-[#141413] border-b border-[#e6dfd8] pb-2 uppercase">
                <TrendingUp className="w-4 h-4 text-[#5db872]" />
                Graph Growth Velocity
              </div>
              <div className="grid grid-cols-2 gap-3 text-[#3d3d3a]">
                <div className="bg-[#f5f0e8] p-3 rounded border border-[#e6dfd8]">
                  <div className="text-[10px] text-[#6c6a64]">TOTAL SNAPS</div>
                  <div className="text-lg font-bold">
                    {growthData.total_snapshots || 0}
                  </div>
                </div>
                <div className="bg-[#f5f0e8] p-3 rounded border border-[#e6dfd8]">
                  <div className="text-[10px] text-[#6c6a64]">GROWTH RATE</div>
                  <div className="text-lg font-bold text-[#5db872]">
                    +{growthData.growth_rate || 0}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !error && !isImproving && !historyData && !growthData && (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#e6dfd8] rounded-xl text-[#6c6a64] min-h-[180px]">
          <BrainCircuit className="w-12 h-12 mb-4 opacity-20" />
          <p className="text-sm">
            The refinery is standing by. Run an evolution cycle to optimize the
            knowledge graph.
          </p>
        </div>
      )}
    </div>
  );
}
