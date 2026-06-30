"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Award,
  Zap,
  ShieldAlert,
  FileText,
  BarChart3,
  TrendingUp,
  Activity,
  Database,
  Terminal,
  Trash2,
} from "lucide-react";
import {
  MemoryHealthStats,
  fetchSchemaInventory,
  fetchObservabilityTraces,
  clearObservabilityTraces,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface FeedbackItem {
  sessionId: string;
  score: number;
  comment: string;
  timestamp: string;
}

interface AuditDeckProps {
  feedbackList: FeedbackItem[];
  nodeCount: number;
  linkCount: number;
  healthStats: MemoryHealthStats | null;
}

export default function AuditDeck({
  feedbackList,
  nodeCount,
  linkCount,
  healthStats,
}: AuditDeckProps) {
  const [schemaData, setSchemaData] = useState<Record<string, unknown> | null>(
    null,
  );
  const [tracesData, setTracesData] = useState<Record<string, unknown> | null>(
    null,
  );
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const handleFetchSchema = async () => {
    setIsLoadingAudit(true);
    try {
      toast.info("Inspecting active Pydantic ontology schemas...");
      const s = await fetchSchemaInventory();
      setSchemaData(s);
      toast.success("Ontology schemas loaded successfully!");
    } catch (e: unknown) {
      toast.error(
        `Error loading schemas: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleFetchTraces = async () => {
    setIsLoadingAudit(true);
    try {
      toast.info("Retrieving system observability traces...");
      const t = await fetchObservabilityTraces();
      setTracesData(t);
      toast.success("Observability traces retrieved!");
    } catch (e: unknown) {
      toast.error(
        `Error loading traces: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleClearTraces = async () => {
    try {
      await clearObservabilityTraces();
      setTracesData(null);
      toast.success("Observability traces cleared.");
    } catch (e: unknown) {
      toast.error(
        `Error clearing traces: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const displayNodeCount = healthStats?.graph?.total_nodes ?? nodeCount;
  const displayLinkCount = healthStats?.graph?.total_edges ?? linkCount;

  const decayPct = healthStats?.decay?.decay_percentage ?? 0;
  const decayBarColor =
    decayPct < 5 ? "#5db872" : decayPct < 15 ? "#e8a55a" : "#c64545";

  const getScoreBadgeColor = (score: number) => {
    return score >= 4
      ? "bg-[#efe9de] text-[#141413] border-[#e6dfd8]"
      : "bg-[#f5f0e8] text-[#c64545] border-[#e6dfd8]";
  };

  const feedbackDistribution = [0, 0, 0, 0, 0];
  feedbackList.forEach((item) => {
    const idx = Math.min(Math.max(item.score - 1, 0), 4);
    feedbackDistribution[idx]++;
  });

  const chartData = [1, 2, 3, 4, 5].map((score) => ({
    score: `${score}`,
    count: feedbackDistribution[score - 1],
    fill: score >= 4 ? "#5db872" : score >= 3 ? "#e8a55a" : "#c64545",
  }));

  const hasFeedback = chartData.some((d) => d.count > 0);

  const avgScore =
    feedbackList.length > 0
      ? (
          feedbackList.reduce((acc, curr) => acc + curr.score, 0) /
          feedbackList.length
        ).toFixed(1)
      : "—";

  const nodeTypeData = healthStats?.graph?.node_type_breakdown
    ? Object.entries(healthStats.graph.node_type_breakdown).map(
        ([type, count]) => ({
          type,
          count,
          fill:
            type === "Service"
              ? "#5db872"
              : type === "Incident" || type === "Alert"
                ? "#c64545"
                : type === "Mitigation"
                  ? "#cc785c"
                  : type === "ArchitecturalDecision" || type === "ADR"
                    ? "#e8a55a"
                    : "#6c6a64",
        }),
      )
    : [];

  const improvementRate =
    feedbackList.length > 0
      ? Math.round(
          (feedbackList.filter((f) => f.score >= 4).length /
            feedbackList.length) *
            100,
        )
      : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-[#6c6a64]">
              Total Ingested Nodes
            </CardTitle>
            <FileText className="w-4 h-4 text-[#cc785c]" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-[#141413]">
              {displayNodeCount}
            </div>
            <p className="text-[10px] text-[#6c6a64] mt-1 uppercase">
              Persistent graph elements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-[#6c6a64]">
              Dependency Edges
            </CardTitle>
            <Zap className="w-4 h-4 text-[#5db872]" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-[#141413]">
              {displayLinkCount}
            </div>
            <p className="text-[10px] text-[#6c6a64] mt-1 uppercase">
              Mapped connection constraints
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-[#6c6a64]">
              Average Feedback
            </CardTitle>
            <Award className="w-4 h-4 text-[#e8a55a]" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-[#141413]">
              {avgScore}
              {avgScore !== "—" && (
                <span className="text-xs font-normal text-[#6c6a64]">/5</span>
              )}
            </div>
            <p className="text-[10px] text-[#6c6a64] mt-1 uppercase">
              Retrieval weight alignment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-[#6c6a64]">
              Knowledge Decay
            </CardTitle>
            <Activity className="w-4 h-4" style={{ color: decayBarColor }} />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-[#141413]">
              {decayPct}%
            </div>
            <p className="text-[10px] text-[#6c6a64] mt-1 uppercase">
              Stale node ratio
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="border-b border-[#e6dfd8]">
            <CardTitle className="text-sm font-semibold text-[#141413]">
              Feedback Audit Logs
            </CardTitle>
            <CardDescription className="text-xs text-[#6c6a64]">
              Direct telemetry feedback triggers for Cognee self-improvement
              weight corrections
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {feedbackList.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-[#6c6a64]">
                No user feedback triggers submitted in this session. Use the
                Copilot to query memory and rate responses.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-xs text-[#6c6a64] uppercase w-24">
                      Score
                    </TableHead>
                    <TableHead className="font-mono text-xs text-[#6c6a64] uppercase w-32">
                      Session ID
                    </TableHead>
                    <TableHead className="font-mono text-xs text-[#6c6a64] uppercase">
                      Comments / Insights
                    </TableHead>
                    <TableHead className="font-mono text-xs text-[#6c6a64] uppercase text-right w-24">
                      Time
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedbackList.map((item, idx) => (
                    <TableRow
                      key={idx}
                      className="hover:bg-[#f5f0e8] border-b border-[#e6dfd8]"
                    >
                      <TableCell className="font-mono">
                        <span
                          className={`border rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${getScoreBadgeColor(item.score)}`}
                        >
                          {item.score}/5
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#6c6a64]">
                        {item.sessionId}
                      </TableCell>
                      <TableCell className="text-[#3d3d3a] text-xs">
                        {item.comment}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-[#6c6a64] text-right">
                        {item.timestamp}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b border-[#e6dfd8] p-3">
              <CardTitle className="text-xs font-mono font-semibold text-[#141413] flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#cc785c]" />
                Feedback Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {hasFeedback ? (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd8" />
                    <XAxis
                      dataKey="score"
                      tick={{ fontSize: 10, fill: "#6c6a64" }}
                      axisLine={{ stroke: "#e6dfd8" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#6c6a64" }}
                      axisLine={{ stroke: "#e6dfd8" }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#faf9f5",
                        border: "1px solid #e6dfd8",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[140px] flex items-center justify-center text-[10px] font-mono text-[#6c6a64]">
                  No feedback data yet
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-[#e6dfd8] p-3">
              <CardTitle className="text-xs font-mono font-semibold text-[#141413] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#5db872]" />
                Knowledge Health
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <div className="flex justify-between text-[10px] font-mono text-[#6c6a64]">
                <span>Growth trend</span>
                <span className="text-[#5db872] font-semibold">
                  +{displayNodeCount} nodes
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#6c6a64]">
                <span>Decay index</span>
                <span
                  className="font-semibold"
                  style={{ color: decayBarColor }}
                >
                  {decayPct}%
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#6c6a64]">
                <span>Avg edges/node</span>
                <span className="text-[#141413] font-semibold">
                  {displayNodeCount > 0
                    ? (displayLinkCount / displayNodeCount).toFixed(2)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#6c6a64]">
                <span>Improvement rate</span>
                <span className="text-[#141413] font-semibold">
                  {improvementRate !== null ? `${improvementRate}%` : "—"}
                </span>
              </div>
              <div className="w-full bg-[#efe9de] h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-linear-to-r from-[#5db872] via-[#e8a55a] to-[#c64545] h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${improvementRate ?? 85}%`,
                  }}
                />
              </div>
              <div className="text-[9px] font-mono text-[#6c6a64] text-center">
                Memory retention quality index
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="border-b border-[#e6dfd8] p-3">
            <CardTitle className="text-xs font-mono font-semibold text-[#141413] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#cc785c]" />
              Node Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {nodeTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={nodeTypeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd8" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#6c6a64" }}
                    axisLine={{ stroke: "#e6dfd8" }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="type"
                    tick={{ fontSize: 10, fill: "#6c6a64" }}
                    axisLine={{ stroke: "#e6dfd8" }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#faf9f5",
                      border: "1px solid #e6dfd8",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {nodeTypeData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-[10px] font-mono text-[#6c6a64]">
                No node data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-[#e6dfd8] p-3">
            <CardTitle className="text-xs font-mono font-semibold text-[#141413] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#cc785c]" />
              Ontology Conformity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono text-[#6c6a64]">
                <span>Class mapping validation</span>
                <span className="text-[#141413] font-semibold">
                  {healthStats?.graph?.total_nodes ? "—" : "—"}%
                </span>
              </div>
              <div className="w-full bg-[#efe9de] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#5db872] h-full rounded-full transition-all duration-500"
                  style={{
                    width: "0%",
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono text-[#6c6a64]">
                <span>Service entity completeness</span>
                <span className="text-[#141413] font-semibold">
                  {nodeTypeData.find((d) => d.type === "Service")
                    ? Math.min(
                        Math.round(
                          ((nodeTypeData.find((d) => d.type === "Service")
                            ?.count ?? 0) /
                            displayNodeCount) *
                            100,
                        ),
                        100,
                      )
                    : "—"}
                  %
                </span>
              </div>
              <div className="w-full bg-[#efe9de] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#5db872] h-full rounded-full transition-all duration-500"
                  style={{
                    width: nodeTypeData.find((d) => d.type === "Service")
                      ? `${Math.min(Math.round(((nodeTypeData.find((d) => d.type === "Service")?.count ?? 0) / displayNodeCount) * 100), 100)}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono text-[#6c6a64]">
                <span>Incident relation lineage</span>
                <span className="text-[#141413] font-semibold">
                  {displayLinkCount > 0 && displayNodeCount > 0
                    ? `${Math.min(
                        Math.round((displayLinkCount / displayNodeCount) * 100),
                        100,
                      )}%`
                    : "—"}
                </span>
              </div>
              <div className="w-full bg-[#efe9de] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#e8a55a] h-full rounded-full transition-all duration-500"
                  style={{
                    width:
                      displayLinkCount > 0 && displayNodeCount > 0
                        ? `${Math.min(
                            Math.round(
                              (displayLinkCount / displayNodeCount) * 100,
                            ),
                            100,
                          )}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
            <div className="bg-[#f5f0e8] border border-[#e6dfd8] rounded p-2 text-[9px] font-mono text-[#6c6a64] flex gap-1.5 items-start">
              <ShieldAlert className="w-3 h-3 text-[#cc785c] shrink-0 mt-0.5" />
              <span>
                {healthStats?.graph?.total_nodes
                  ? "Nodes validated against ITIL ontology via validate_against_ontology pipeline task"
                  : "Ingest data to generate ontology validation metrics"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-[#e6dfd8] p-3">
            <CardTitle className="text-xs font-mono font-semibold text-[#141413] flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#e8a55a]" />
              Recent Feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {feedbackList.length > 0 ? (
              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {feedbackList.slice(0, 5).map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-[#f5f0e8] border border-[#e6dfd8] rounded p-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[9px] font-mono font-bold px-1 rounded ${getScoreBadgeColor(item.score)}`}
                      >
                        {item.score}/5
                      </span>
                      <span className="text-[9px] font-mono text-[#6c6a64]">
                        {item.timestamp}
                      </span>
                    </div>
                    {item.comment && (
                      <div className="text-[10px] text-[#3d3d3a]">
                        {item.comment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-[10px] font-mono text-[#6c6a64]">
                No feedback yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader className="border-b border-[#e6dfd8] p-3 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-mono font-semibold text-[#141413] flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#cc785c]" />
              Pydantic Ontology Schema Inventory
            </CardTitle>
            <Button
              onClick={handleFetchSchema}
              disabled={isLoadingAudit}
              variant="outline"
              size="sm"
              className="text-[10px] font-mono h-7"
            >
              Inspect Schemas
            </Button>
          </CardHeader>
          <CardContent className="p-3 font-mono text-xs max-h-[220px] overflow-y-auto">
            {schemaData ? (
              <pre className="text-[10px] whitespace-pre-wrap text-[#3d3d3a]">
                {JSON.stringify(schemaData, null, 2)}
              </pre>
            ) : (
              <div className="h-[140px] flex items-center justify-center text-[#6c6a64] italic text-[10px]">
                Click Inspect Schemas to query active Pydantic data models.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-[#e6dfd8] p-3 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-mono font-semibold text-[#141413] flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-[#5db872]" />
              System Observability Traces
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={handleFetchTraces}
                disabled={isLoadingAudit}
                variant="outline"
                size="sm"
                className="text-[10px] font-mono h-7"
              >
                Fetch Traces
              </Button>
              {tracesData && (
                <Button
                  onClick={handleClearTraces}
                  variant="outline"
                  size="sm"
                  className="text-[10px] font-mono h-7 border-[#c64545]/40 text-[#c64545]"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 font-mono text-xs max-h-[220px] overflow-y-auto">
            {tracesData ? (
              <pre className="text-[10px] whitespace-pre-wrap text-[#3d3d3a]">
                {JSON.stringify(tracesData, null, 2)}
              </pre>
            ) : (
              <div className="h-[140px] flex items-center justify-center text-[#6c6a64] italic text-[10px]">
                Click Fetch Traces to inspect backend agent execution telemetry.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
