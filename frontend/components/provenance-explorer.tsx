/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import { fetchLineage, LineageResponse } from "@/lib/api";
import { Network, Database, FileText, CheckCircle, Clock } from "lucide-react";

interface ProvenanceExplorerProps {
  nodeId: string | null;
}

export default function ProvenanceExplorer({
  nodeId,
}: ProvenanceExplorerProps) {
  const [loading, setLoading] = useState(false);
  const [lineage, setLineage] = useState<LineageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nodeId) {
      setLineage(null);
      setError(null);
      return;
    }

    const getLineage = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLineage(nodeId);
        setLineage(data);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch lineage",
        );
      } finally {
        setLoading(false);
      }
    };

    getLineage();
  }, [nodeId]);

  if (!nodeId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#6c6a64] border-2 border-dashed border-[#e6dfd8] rounded-xl bg-[#faf9f5]">
        <Network className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm">
          Select a node in the 3D War Room to trace its Knowledge DNA and origin
          lineage.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-[#cc785c]">
        <div className="w-6 h-6 border-2 border-[#cc785c] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-mono">Tracing Relational Lineage...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-[#c64545]/10 border border-[#c64545]/30 rounded-lg text-[#c64545] text-sm font-mono m-4">
        {error}
      </div>
    );
  }

  if (!lineage) return null;

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#faf9f5]">
      <h3 className="text-sm font-bold font-heading text-[#141413] mb-6 flex items-center gap-2">
        <Database className="w-4 h-4 text-[#cc785c]" />
        Knowledge DNA (Data Lineage)
      </h3>

      <div className="space-y-6">
        {/* Node Info */}
        <div className="bg-white border border-[#e6dfd8] p-4 rounded-lg shadow-sm relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#cc785c] rounded-l-lg" />
          <div className="text-xs font-mono text-[#6c6a64] uppercase tracking-wider mb-1">
            Graph Entity
          </div>
          <div className="font-medium text-[#141413]">{lineage.name}</div>
          <div className="text-xs text-[#cc785c] font-mono mt-1">
            Type: {lineage.type}
          </div>
          <div className="text-[10px] text-[#a09d96] font-mono mt-2 break-all">
            ID: {lineage.node_id}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-px h-6 bg-[#cc785c]/30" />
          <div className="w-2 h-2 rounded-full bg-[#cc785c]" />
          <div className="w-px h-6 bg-[#cc785c]/30" />
        </div>

        {/* Pipeline Info */}
        <div className="bg-white border border-[#e6dfd8] p-4 rounded-lg shadow-sm">
          <div className="text-xs font-mono text-[#6c6a64] uppercase tracking-wider mb-3">
            Ingestion Pipeline
          </div>
          <div className="space-y-2">
            {lineage.lineage?.pipeline_tasks_run?.map(
              (task: string, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs text-[#3d3d3a] font-mono"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-[#5db872]" />
                  {task}
                </div>
              ),
            )}
          </div>
          {lineage.lineage?.ontology_valid && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-[#5db872]/10 text-[#5db872] px-2 py-1 rounded text-[10px] font-bold font-mono uppercase border border-[#5db872]/30">
              <CheckCircle className="w-3 h-3" /> Ontology Validated (ITIL)
            </div>
          )}
        </div>

        <div className="flex flex-col items-center">
          <div className="w-px h-6 bg-[#cc785c]/30" />
          <div className="w-2 h-2 rounded-full bg-[#cc785c]" />
          <div className="w-px h-6 bg-[#cc785c]/30" />
        </div>

        {/* Provenance Document Info */}
        <div className="bg-white border border-[#e6dfd8] p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-mono text-[#6c6a64] uppercase tracking-wider">
              Source Document (Relational DB)
            </div>
            <FileText className="w-4 h-4 text-[#cc785c]" />
          </div>
          <div className="bg-[#f5f0e8] border border-[#e6dfd8] p-3 rounded text-xs text-[#141413] font-mono whitespace-pre-wrap leading-relaxed">
            {lineage.lineage?.raw_text_chunk}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div>
              <div className="text-[#a09d96]">Document ID</div>
              <div
                className="text-[#3d3d3a] truncate"
                title={lineage.lineage?.document_id}
              >
                {lineage.lineage?.document_id}
              </div>
            </div>
            <div>
              <div className="text-[#a09d96]">Chunk ID</div>
              <div
                className="text-[#3d3d3a] truncate"
                title={lineage.lineage?.chunk_id}
              >
                {lineage.lineage?.chunk_id}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[10px] font-mono text-[#a09d96]">
            <Clock className="w-3 h-3" />
            Ingested:{" "}
            {new Date(lineage.lineage?.ingested_at || "").toLocaleString()}
          </div>
        </div>

        {/* Triple Store Proof */}
        <div className="mt-4 text-center">
          <div className="inline-block px-3 py-1.5 bg-[#141413] text-[#a09d96] rounded-full text-[10px] font-mono border border-[#3d3d3a]">
            Stored in: {lineage.lineage?.storage}
          </div>
        </div>
      </div>
    </div>
  );
}
