"use client";

import React, { useState } from "react";
import { compareStatelessVsCognee } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Zap, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CompareResult {
  question: string;
  stateless: {
    answer: string;
    has_memory: boolean;
    can_reference_past: boolean;
  };
  cognee_powered: {
    answer: string;
    has_memory: boolean;
    can_reference_past: boolean;
    graph_nodes_used: number;
  };
}

const SAMPLE_QUESTIONS = [
  "What caused the auth service outage?",
  "Have we seen latency spikes in checkout before?",
  "Who investigated the last database deadlock?",
];

export default function CompareView() {
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS[0]);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCompare = async (q?: string) => {
    const query = q || question;
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      toast.info(
        "Running benchmark: Stateless LLM vs Cognee Persistent Graph Memory...",
      );
      const res = await compareStatelessVsCognee(query);
      setResult(res);
      toast.success("Comparison benchmark completed!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Comparison failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#cc785c]/10">
          <BrainCircuit className="w-4 h-4 text-[#cc785c]" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[#141413] uppercase tracking-wider font-mono">
            Stateless vs Cognee Comparison
          </h2>
          <p className="text-[10px] text-[#6c6a64] font-mono">
            See why memory matters — same question, different intelligence
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCompare()}
          placeholder="Ask a question about past incidents..."
          className="flex-1 bg-[#faf9f5] border border-[#e6dfd8] rounded-lg px-4 py-2.5 text-sm text-[#141413] placeholder:text-[#6c6a64]/50 focus:outline-none focus:border-[#cc785c] font-mono"
        />
        <Button
          onClick={() => handleCompare()}
          disabled={loading || !question.trim()}
          className="bg-[#cc785c] hover:bg-[#a9583e] text-white font-mono text-xs px-4"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          Compare
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SAMPLE_QUESTIONS.map((sq, i) => (
          <button
            key={i}
            onClick={() => {
              setQuestion(sq);
              handleCompare(sq);
            }}
            disabled={loading}
            className="text-[10px] font-mono text-[#6c6a64] bg-[#f5f0e8] hover:bg-[#efe9de] border border-[#e6dfd8] rounded px-2 py-1 transition cursor-pointer disabled:opacity-50"
          >
            {sq}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-[#c64545]/10 border border-[#c64545]/30 text-[#c64545] px-4 py-2 rounded-lg text-xs font-mono">
          {error}
        </div>
      )}

      {result && (
        <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
          <div className="flex flex-col border border-[#e6dfd8] rounded-lg overflow-hidden bg-[#faf9f5] shadow-sm">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f5f0e8] border-b border-[#e6dfd8]">
              <Zap className="w-3.5 h-3.5 text-[#6c6a64]" />
              <span className="text-[11px] font-mono font-bold text-[#141413] uppercase tracking-wider">
                Stateless LLM
              </span>
              <span className="ml-auto text-[9px] font-mono text-[#c64545] bg-[#c64545]/10 px-1.5 py-0.5 rounded">
                NO MEMORY
              </span>
            </div>
            <div className="flex-1 p-4 overflow-auto">
              <div className="text-xs text-[#3d3d3a] leading-relaxed whitespace-pre-wrap font-sans">
                {result.stateless.answer}
              </div>
            </div>
            <div className="px-4 py-2 bg-[#f5f0e8] border-t border-[#e6dfd8] text-[9px] font-mono text-[#6c6a64]">
              Can reference past incidents: No | Has graph context: No
            </div>
          </div>

          <div className="flex flex-col border border-[#cc785c]/30 rounded-lg overflow-hidden bg-[#faf9f5] shadow-sm ring-1 ring-[#cc785c]/10">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#cc785c]/5 border-b border-[#cc785c]/20">
              <BrainCircuit className="w-3.5 h-3.5 text-[#cc785c]" />
              <span className="text-[11px] font-mono font-bold text-[#cc785c] uppercase tracking-wider">
                Cognee Memory-Powered
              </span>
              <span className="ml-auto text-[9px] font-mono text-[#5db872] bg-[#5db872]/10 px-1.5 py-0.5 rounded">
                HAS MEMORY
              </span>
            </div>
            <div className="flex-1 p-4 overflow-auto">
              <div className="text-xs text-[#3d3d3a] leading-relaxed whitespace-pre-wrap font-sans">
                {result.cognee_powered.answer}
              </div>
            </div>
            <div className="px-4 py-2 bg-[#cc785c]/5 border-t border-[#cc785c]/20 text-[9px] font-mono text-[#6c6a64]">
              Can reference past incidents: Yes | Graph nodes used:{" "}
              {result.cognee_powered.graph_nodes_used}
            </div>
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#cc785c]/10 mx-auto">
              <BrainCircuit className="w-8 h-8 text-[#cc785c]/40" />
            </div>
            <div className="text-sm text-[#6c6a64] font-mono">
              Ask a question to see the difference memory makes
            </div>
            <div className="text-[10px] text-[#6c6a64]/60 font-mono max-w-md">
              The left panel answers from nothing - no context, no history. The
              right panel answers from a living knowledge graph of all past
              incidents.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
