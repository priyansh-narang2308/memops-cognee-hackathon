"use client";

import React from "react";
import { Shield, ShieldAlert, ShieldCheck, Clock, AlertTriangle } from "lucide-react";

interface MemoryBadgesProps {
  result?: string;
}

function computeTrustScore(result: string): number {
  let score = 0.5;
  if (result.includes("DEPENDS_ON") || result.includes("graph")) score += 0.15;
  if (result.includes("similar") || result.includes("past incident")) score += 0.1;
  if (result.includes("mitigation") || result.includes("fix")) score += 0.1;
  if (result.length > 200) score += 0.1;
  if (result.length < 50) score -= 0.1;
  return Math.min(Math.max(score, 0.0), 1.0);
}

function detectSecrets(result: string): boolean {
  const patterns = [
    /api[_-]?key\s*[=:]\s*\S+/i,
    /secret\s*[=:]\s*\S+/i,
    /password\s*[=:]\s*\S+/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN.*PRIVATE KEY-----/,
    /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}/,
  ];
  return patterns.some((p) => p.test(result));
}

function detectTemporalSupersession(result: string): boolean {
  return (
    result.includes("supersedes") ||
    result.includes("replaced by") ||
    result.includes("newer version") ||
    result.includes("updated in")
  );
}

export default function MemoryBadges({ result }: MemoryBadgesProps) {
  if (!result) return null;

  const trust = computeTrustScore(result);
  const hasSecrets = detectSecrets(result);
  const hasSupersession = detectTemporalSupersession(result);

  const trustColor =
    trust >= 0.7
      ? "text-[#5db872] bg-[#5db872]/10 border-[#5db872]/30"
      : trust >= 0.4
        ? "text-[#e8a55a] bg-[#e8a55a]/10 border-[#e8a55a]/30"
        : "text-[#c64545] bg-[#c64545]/10 border-[#c64545]/30";

  const trustIcon =
    trust >= 0.7 ? (
      <ShieldCheck className="w-3 h-3" />
    ) : trust >= 0.4 ? (
      <Shield className="w-3 h-3" />
    ) : (
      <ShieldAlert className="w-3 h-3" />
    );

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border ${trustColor}`}
      >
        {trustIcon}
        Trust: {Math.round(trust * 100)}%
      </span>

      {hasSecrets && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold text-[#c64545] bg-[#c64545]/10 border border-[#c64545]/30">
          <AlertTriangle className="w-3 h-3" />
          Secrets Auto-Redacted
        </span>
      )}

      {hasSupersession && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold text-[#8b5cf6] bg-[#8b5cf6]/10 border border-[#8b5cf6]/30">
          <Clock className="w-3 h-3" />
          Temporal Supersession
        </span>
      )}
    </div>
  );
}
