"use client";

import React from "react";
import { GraphData } from "@/lib/api";
import { Clock, AlertTriangle, GitBranch, Bell } from "lucide-react";

interface TemporalEvent {
  id: string;
  type: "incident_start" | "incident_end" | "decision_made" | "alert_triggered";
  label: string;
  timestamp: string;
  nodeType: string;
  severity?: string;
}

interface TemporalTimelineProps {
  graphData: GraphData;
  currentDate?: Date | null;
}

export default function TemporalTimeline({
  graphData,
  currentDate,
}: TemporalTimelineProps) {
  const events: TemporalEvent[] = [];

  graphData.nodes.forEach((node) => {
    const attrs = node.attributes || {};
    const temporalEvents = attrs.temporal_events as
      | Array<{
          type: string;
          timestamp: string;
          label: string;
        }>
      | undefined;

    if (temporalEvents && Array.isArray(temporalEvents)) {
      temporalEvents.forEach((ev) => {
        events.push({
          id: `${node.id}-${ev.type}-${ev.timestamp}`,
          type: ev.type as TemporalEvent["type"],
          label: ev.label,
          timestamp: ev.timestamp,
          nodeType: node.type || attrs.type || "Unknown",
          severity: attrs.severity,
        });
      });
    }

    const type = node.type || attrs.type || "";
    if ((type === "Incident" || type === "Alert") && attrs.start_time) {
      events.push({
        id: `${node.id}-start`,
        type: "incident_start",
        label: node.name || attrs.name || node.id,
        timestamp: attrs.start_time,
        nodeType: type,
        severity: attrs.severity,
      });
    }
    if (type === "Incident" && attrs.end_time) {
      events.push({
        id: `${node.id}-end`,
        type: "incident_end",
        label: `${node.name || attrs.name || node.id} resolved`,
        timestamp: attrs.end_time,
        nodeType: type,
      });
    }
    if (type === "ArchitecturalDecision" && attrs.date) {
      events.push({
        id: `${node.id}-decision`,
        type: "decision_made",
        label: attrs.decision || node.name || node.id,
        timestamp: attrs.date,
        nodeType: type,
      });
    }
    if (type === "Alert" && attrs.triggered_at) {
      events.push({
        id: `${node.id}-alert`,
        type: "alert_triggered",
        label: `${attrs.source || node.name || node.id} exceeded ${attrs.threshold || "threshold"}`,
        timestamp: attrs.triggered_at,
        nodeType: type,
      });
    }
  });

  events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const visibleEvents = currentDate
    ? events.filter(
        (e) => new Date(e.timestamp).getTime() <= currentDate.getTime(),
      )
    : events;

  if (events.length === 0) {
    return (
      <div className="bg-[#faf9f5] border border-[#e6dfd8] rounded-lg p-8 text-center font-mono text-xs text-[#6c6a64]">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
        No temporal events extracted yet. Ingest incident reports with temporal
        metadata.
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "incident_start":
      case "incident_end":
        return <AlertTriangle className="w-3.5 h-3.5 text-[#c64545]" />;
      case "decision_made":
        return <GitBranch className="w-3.5 h-3.5 text-[#e8a55a]" />;
      case "alert_triggered":
        return <Bell className="w-3.5 h-3.5 text-[#cc785c]" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-[#6c6a64]" />;
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "incident_start":
        return "bg-[#c64545]/10 text-[#c64545] border-[#c64545]/30";
      case "incident_end":
        return "bg-[#5db872]/10 text-[#5db872] border-[#5db872]/30";
      case "decision_made":
        return "bg-[#e8a55a]/10 text-[#e8a55a] border-[#e8a55a]/30";
      case "alert_triggered":
        return "bg-[#cc785c]/10 text-[#cc785c] border-[#cc785c]/30";
      default:
        return "bg-[#efe9de] text-[#6c6a64] border-[#e6dfd8]";
    }
  };

  return (
    <div className="bg-[#faf9f5] border border-[#e6dfd8] rounded-lg p-5 flex-1 min-h-[150px] overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <Clock className="w-4 h-4 text-[#cc785c]" />
        <h3 className="text-xs font-mono font-bold text-[#141413] uppercase tracking-wider">
          Temporal Event Timeline
        </h3>
        <span className="text-[10px] font-mono text-[#6c6a64] ml-auto">
          {visibleEvents.length} / {events.length} events
        </span>
      </div>

      <div className="relative flex-1 overflow-y-auto">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-[#e6dfd8]" />

        <div className="space-y-3">
          {visibleEvents
            .slice(-50)
            .reverse()
            .map((event) => {
              const date = new Date(event.timestamp);
              const formatted = isNaN(date.getTime())
                ? event.timestamp
                : date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

              return (
                <div key={event.id} className="relative pl-10">
                  <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-[#faf9f5] border-2 border-[#cc785c] z-10 flex items-center justify-center">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        event.type === "incident_start"
                          ? "bg-[#c64545]"
                          : event.type === "incident_end"
                            ? "bg-[#5db872]"
                            : event.type === "decision_made"
                              ? "bg-[#e8a55a]"
                              : "bg-[#cc785c]"
                      }`}
                    />
                  </div>
                  <div className="flex items-start gap-3 bg-[#f5f0e8] border border-[#e6dfd8] rounded-lg p-2.5 hover:bg-[#efe9de] transition-colors cursor-pointer">
                    <div
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase border shrink-0 ${getBadgeColor(event.type)}`}
                    >
                      {getIcon(event.type)}
                      <span>
                        {event.type === "incident_start"
                          ? "Incident"
                          : event.type === "incident_end"
                            ? "Resolved"
                            : event.type === "decision_made"
                              ? "ADR"
                              : "Alert"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[#141413] font-medium truncate">
                        {event.label}
                      </div>
                      <div className="text-[10px] font-mono text-[#6c6a64] mt-0.5">
                        {event.nodeType}
                        {event.severity ? ` · ${event.severity}` : ""}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-[#6c6a64] shrink-0 text-right whitespace-nowrap">
                      {formatted}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
