/* eslint-disable react-hooks/purity */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  fetchGraph,
  fetchHealthStats,
  executeMitigation,
  pruneMemory,
  setupMultiUser,
  loadDemoData,
  GraphData,
  GraphNode,
  MemoryHealthStats,
  MitigationResponse,
} from "@/lib/api";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import IncidentControl from "@/components/incident-control";
import SRECopilot from "@/components/sre-copilot";
import InspectorPanel from "@/components/inspector-panel";
import AuditDeck, { FeedbackItem } from "@/components/audit-deck";
import TemporalTimeline from "@/components/temporal-timeline";
import TemporalSlider from "@/components/temporal-slider";
import CognitiveRefinery from "@/components/cognitive-refinery";
import ProvenanceExplorer from "@/components/provenance-explorer";
import CompareView from "@/components/compare-view";
import ErrorBoundary from "@/components/error-boundary";
import AgentInvocationPanel from "@/components/agent-invocation-panel";
import { toast } from "sonner";
import {
  Terminal,
  RefreshCw,
  Layers,
  PlusCircle,
  Mic,
  FileText,
  ChevronRight,
  Clock,
  Filter,
  BrainCircuit,
  Database,
  Users,
  Shield,
  GitCompare,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const Graph3D = dynamic(() => import("@/components/graph3d"), { ssr: false });

type TabView =
  | "war-room"
  | "ingest"
  | "copilot"
  | "agents"
  | "audit"
  | "refinery"
  | "lineage"
  | "compare";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  tenant: string;
  avatar: string;
}

const DEMO_USERS: UserInfo[] = [
  {
    id: "admin",
    name: "Admin",
    email: "admin@memops.io",
    role: "Senior SRE",
    tenant: "Infrastructure Team",
    avatar: "A",
  },
  {
    id: "alice",
    name: "Alice Chen",
    email: "alice@memops.io",
    role: "SRE",
    tenant: "Payments Team",
    avatar: "AC",
  },
  {
    id: "bob",
    name: "Bob Martinez",
    email: "bob@memops.io",
    role: "SRE",
    tenant: "Payments Team",
    avatar: "BM",
  },
];

interface CascadeResult {
  outageNodeId: string;
  cascadeIds: Set<string>;
}

function computeCascade(
  graphData: GraphData,
  sourceId: string,
  maxHops = 3,
): CascadeResult {
  const adj = new Map<string, Set<string>>();
  graphData.links.forEach((link) => {
    const s =
      typeof link.source === "object" ? (link.source as any).id : link.source;
    const t =
      typeof link.target === "object" ? (link.target as any).id : link.target;
    if (!adj.has(s)) adj.set(s, new Set());
    if (!adj.has(t)) adj.set(t, new Set());
    adj.get(s)!.add(t);
    adj.get(t)!.add(s);
  });

  const visited = new Set<string>();
  const queue: Array<{ id: string; hop: number }> = [{ id: sourceId, hop: 0 }];
  visited.add(sourceId);

  while (queue.length > 0) {
    const { id, hop } = queue.shift()!;
    if (hop >= maxHops) continue;
    const neighbors = adj.get(id);
    if (neighbors) {
      neighbors.forEach((nid) => {
        if (!visited.has(nid)) {
          visited.add(nid);
          queue.push({ id: nid, hop: hop + 1 });
        }
      });
    }
  }

  return { outageNodeId: sourceId, cascadeIds: visited };
}

function DashboardContent() {
  const [activeTab, setActiveTab] = useState<TabView>("war-room");
  const { isMobile, setOpenMobile } = useSidebar();
  const [sessionId, setSessionId] = useState("");
  const [searchType, setSearchType] = useState("GRAPH_COMPLETION");
  const [graphData, setGraphData] = useState<GraphData>({
    nodes: [],
    links: [],
  });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [mitigationProposal, setMitigationProposal] = useState<{
    description: string;
    command: string;
  } | null>(null);
  const [executionResult, setExecutionResult] =
    useState<MitigationResponse | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [healthStats, setHealthStats] = useState<MemoryHealthStats | null>(
    null,
  );
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [simulatedOutageNodeId, setSimulatedOutageNodeId] = useState<
    string | null
  >(null);
  const [cascadeNodeIds, setCascadeNodeIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCriticality, setFilterCriticality] = useState<string>("all");
  const [showTimeline, setShowTimeline] = useState(false);
  const [temporalDate, setTemporalDate] = useState<Date | null>(null);
  const [temporalRange, setTemporalRange] = useState<{
    min: Date;
    max: Date;
  } | null>(null);
  const [currentUser, setCurrentUser] = useState<UserInfo>(DEMO_USERS[0]);
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
  const [multiUserStatus, setMultiUserStatus] = useState<string>("");

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("cognee_session_id")
        : null;
    const newSession =
      saved || `sre_session_${Math.random().toString(36).substring(2, 11)}`;
    if (typeof window !== "undefined" && !saved) {
      localStorage.setItem("cognee_session_id", newSession);
    }
    setSessionId(newSession);
    // eslint-disable-next-line react-hooks/immutability
    loadGraph();
  }, []);

  const loadGraph = async () => {
    setLoading(true);
    try {
      const [data, stats] = await Promise.all([
        fetchGraph("incidents"),
        fetchHealthStats("incidents"),
      ]);
      setGraphData(data);
      setHealthStats(stats);

      // Calculate temporal range
      let minDate = new Date();
      let maxDate = new Date(0);
      let foundDates = false;

      data.nodes.forEach((node) => {
        const attrs = node.attributes || {};
        const dates = [
          attrs.start_time,
          attrs.end_time,
          attrs.date,
          attrs.triggered_at,
          ...(attrs.temporal_events || []).map((e: any) => e.timestamp),
        ].filter(Boolean);

        dates.forEach((d) => {
          const dt = new Date(d);
          if (!isNaN(dt.getTime())) {
            foundDates = true;
            if (dt < minDate) minDate = dt;
            if (dt > maxDate) maxDate = dt;
          }
        });
      });

      if (foundDates) {
        setTemporalRange({ min: minDate, max: maxDate });
        setTemporalDate(maxDate); // Default to current/latest
      } else {
        setTemporalRange(null);
        setTemporalDate(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = (node: GraphNode) => setSelectedNode(node);

  const handleExecuteCommand = async (command: string) => {
    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const res = await executeMitigation(command);
      setExecutionResult(res);
      loadGraph();
    } catch (err: any) {
      setExecutionResult({
        status: "failed",
        stdout: "",
        stderr: err.message || "Execution error",
        exit_code: 1,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleToggleOutageSimulation = useCallback(
    (nodeId: string) => {
      if (simulatedOutageNodeId === nodeId) {
        setSimulatedOutageNodeId(null);
        setCascadeNodeIds(new Set());
      } else {
        const result = computeCascade(graphData, nodeId);
        setSimulatedOutageNodeId(result.outageNodeId);
        setCascadeNodeIds(result.cascadeIds);
      }
    },
    [simulatedOutageNodeId, graphData],
  );

  const handleClearOutage = useCallback(() => {
    setSimulatedOutageNodeId(null);
    setCascadeNodeIds(new Set());
  }, []);

  const handleForgetNode = async (nodeId: string) => {
    try {
      await pruneMemory("incidents", nodeId);
      loadGraph();
    } catch (err: any) {
      alert(`Prune error: ${err.message}`);
    }
  };

  const handleVoiceCommandTriggered = useCallback(
    (command: string, args?: any) => {
      if (command === "simulate-outage" && args?.nodeName) {
        const node = graphData.nodes.find(
          (n) =>
            (n.name || "")
              .toLowerCase()
              .includes(args.nodeName.toLowerCase()) ||
            n.id.toLowerCase().includes(args.nodeName.toLowerCase()),
        );
        if (node) {
          handleToggleOutageSimulation(node.id);
        }
      } else if (command === "clear-outage") {
        handleClearOutage();
      } else if (command === "sync-memory") {
        loadGraph();
      }
    },
    [graphData, handleToggleOutageSimulation, handleClearOutage],
  );

  const handleAddFeedbackToList = (score: number, comment: string) => {
    const newItem: FeedbackItem = {
      sessionId,
      score,
      comment,
      timestamp: new Date().toLocaleTimeString(),
    };
    setFeedbackList((prev) => [newItem, ...prev]);
  };

  const handleFeedbackOverride = (score: number, comment: string) => {
    handleAddFeedbackToList(score, comment);
  };

  const handleSetupMultiUser = async () => {
    try {
      const result = await setupMultiUser();
      setMultiUserStatus(result.status || "configured");
      setTimeout(() => setMultiUserStatus(""), 3000);
    } catch (err: any) {
      setMultiUserStatus(`Error: ${err.message}`);
    }
  };

  const handleLoadDemo = async () => {
    try {
      toast.info("Loading demo incident datasets into Cognee...");
      await loadDemoData("incidents");
      toast.success("Demo dataset loaded successfully!");
      loadGraph();
    } catch (e: any) {
      toast.error(`Failed to load demo data: ${e.message || e}`);
    }
  };

  const handleSwitchUser = (user: UserInfo) => {
    setCurrentUser(user);
    setShowUserSwitcher(false);
    const newSid = `sre_session_${user.id}_${Math.random().toString(36).substring(2, 11)}`;
    if (typeof window !== "undefined")
      localStorage.setItem("cognee_session_id", newSid);
    setSessionId(newSid);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const filteredGraphData = React.useMemo(() => {
    if (filterType === "all" && filterCriticality === "all") return graphData;

    const filteredNodes = graphData.nodes.filter((node) => {
      const type = (node.type || node.attributes?.type || "").toLowerCase();
      const crit = (node.attributes?.criticality || "").toLowerCase();
      const sev = (node.attributes?.severity || "").toLowerCase();

      if (filterType !== "all") {
        if (filterType === "incident" && !["incident", "alert"].includes(type))
          return false;
        if (filterType === "service" && type !== "service") return false;
        if (filterType === "mitigation" && type !== "mitigation") return false;
        if (
          filterType === "adr" &&
          !["architecturaldecision", "adr"].includes(type)
        )
          return false;
      }
      if (filterCriticality !== "all") {
        if (
          !crit.includes(filterCriticality) &&
          !sev.includes(filterCriticality)
        )
          return false;
      }

      if (temporalDate) {
        let firstDateStr =
          node.attributes?.start_time ||
          node.attributes?.date ||
          node.attributes?.triggered_at;
        if (
          !firstDateStr &&
          node.attributes?.temporal_events &&
          node.attributes.temporal_events.length > 0
        ) {
          firstDateStr = node.attributes.temporal_events[0].timestamp;
        }
        if (firstDateStr) {
          const nodeDate = new Date(firstDateStr);
          if (!isNaN(nodeDate.getTime()) && nodeDate > temporalDate) {
            return false;
          }
        }
      }

      return true;
    });

    const filteredIds = new Set(filteredNodes.map((n) => n.id));
    const filteredLinks = graphData.links.filter((link) => {
      const s =
        typeof link.source === "object" ? (link.source as any).id : link.source;
      const t =
        typeof link.target === "object" ? (link.target as any).id : link.target;
      return filteredIds.has(s) && filteredIds.has(t);
    });

    return { nodes: filteredNodes, links: filteredLinks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, filterType, filterCriticality]);

  const navItems = [
    { id: "war-room", icon: Layers, label: "3D War Room" },
    { id: "ingest", icon: PlusCircle, label: "Telemetry Ingest" },
    { id: "copilot", icon: Mic, label: "Voice Copilot" },
    { id: "agents", icon: Bot, label: "AI Agent Invocation" },
    { id: "compare", icon: GitCompare, label: "Stateless vs Cognee" },
    { id: "audit", icon: FileText, label: "Audit Console" },
    { id: "refinery", icon: BrainCircuit, label: "Cognitive Refinery" },
    { id: "lineage", icon: Database, label: "Provenance Explorer" },
  ];

  return (
    <div className="flex h-screen w-screen bg-[#faf9f5] overflow-hidden text-[#141413]">
      <Sidebar className="border-r border-[#e6dfd8]/70 bg-[#faf9f5]">
        <SidebarHeader className="border-b border-[#e6dfd8]/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="group flex items-center gap-4">
              <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-linear-to-br from-[#cc785c] to-[#b86549] shadow-lg ring-1 ring-black/5 transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl">
                <span className="text-white text-lg font-black tracking-tight">
                  M
                </span>
              </div>

              <div className="flex flex-col leading-none">
                <span
                  className="text-xl font-semibold tracking-tight text-[#141413]"
                  style={{
                    fontFamily: "var(--font-heading)",
                    letterSpacing: "-0.04em",
                  }}
                >
                  MemOps
                </span>
              </div>
            </Link>
          </div>
        </SidebarHeader>

        <SidebarContent className="p-3 space-y-6">
          <SidebarGroup>
            <SidebarGroupLabel
              className="px-3 text-[11px] text-[#6c6a64] tracking-[1.5px] uppercase font-medium"
              style={{
                fontFamily: "var(--font-sans)",
                letterSpacing: "1.5px",
              }}
            >
              SRE Views
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="mt-1 space-y-0.5">
                {navItems.map(({ id, icon: Icon, label }) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      isActive={activeTab === id}
                      onClick={() => {
                        setActiveTab(id as TabView);
                        if (isMobile) {
                          setOpenMobile(false);
                        }
                      }}
                      className={`group/menu-button relative w-full px-3 py-2.5 rounded-lg ${
                        activeTab === id
                          ? "bg-[#efe9de] text-[#141413] font-medium shadow-sm"
                          : "text-[#3d3d3a] hover:text-[#141413] hover:bg-[#f5f0e8]"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-5 h-5 ${
                          activeTab === id
                            ? "text-[#cc785c]"
                            : "text-[#6c6a64] group-hover/menu-button:text-[#141413]"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm">{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-[#e6dfd8]/80 px-5 py-4 space-y-2.5">
          {/* Multi-User Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowUserSwitcher(!showUserSwitcher)}
              className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#f5f0e8] transition cursor-pointer"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#cc785c] text-white text-[10px] font-bold font-mono">
                {currentUser.avatar}
              </div>
              <div className="flex-1 text-left">
                <div className="text-xs font-medium text-[#141413]">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-[#6c6a64] font-mono">
                  {currentUser.role}
                </div>
              </div>
              <Users className="w-3.5 h-3.5 text-[#6c6a64]" />
            </button>

            {showUserSwitcher && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#faf9f5] border border-[#e6dfd8] rounded-lg shadow-lg overflow-hidden z-50">
                <div className="p-2 border-b border-[#e6dfd8]">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#6c6a64] uppercase tracking-wider">
                    <Shield className="w-3 h-3" />
                    <span>Switch User Context</span>
                  </div>
                </div>
                <div className="p-1">
                  {DEMO_USERS.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSwitchUser(user)}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-md text-left transition cursor-pointer ${
                        currentUser.id === user.id
                          ? "bg-[#efe9de]"
                          : "hover:bg-[#f5f0e8]"
                      }`}
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#cc785c] text-white text-[9px] font-bold font-mono">
                        {user.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-[#141413] truncate">
                          {user.name}
                        </div>
                        <div className="text-[9px] text-[#6c6a64] font-mono truncate">
                          {user.tenant}
                        </div>
                      </div>
                      {currentUser.id === user.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#5db872]" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-[#e6dfd8]">
                  <button
                    onClick={handleSetupMultiUser}
                    className="w-full text-[10px] font-mono text-[#cc785c] hover:text-[#a9583e] transition py-1 cursor-pointer"
                  >
                    {multiUserStatus || "Initialize Multi-User ACLs"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-[#6c6a64]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#5db872] animate-pulse shadow-[0_0_6px_rgba(93,184,114,0.5)]" />
            <span className="tracking-wider text-[#3d3d3a] font-medium">
              COGNITIVE CORE
            </span>
            <span className="text-[#e6dfd8]">&bull;</span>
            <span className="text-[#6c6a64]">ACTIVE</span>
          </div>
          <div className="text-[10px] font-mono text-[#6c6a64]/60 truncate bg-[#f5f0e8] rounded-md px-2 py-1.5 border border-[#e6dfd8]/50">
            session: {sessionId || "INITIALIZING..."}
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex flex-col h-full overflow-hidden bg-[#faf9f5]">
        <header className="flex items-center justify-between px-6 py-3.5 bg-[#faf9f5] border-b border-[#e6dfd8]/80 shrink-0">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-[#6c6a64] hover:text-[#141413] border border-[#e6dfd8] bg-transparent hover:bg-[#f5f0e8]" />
            <div className="flex items-center gap-2 text-xs font-mono text-[#6c6a64]">
              <span>DASHBOARD</span>
              <ChevronRight className="w-3 h-3 text-[#e6dfd8]" />
              <span className="text-[#141413] uppercase font-medium">
                {activeTab.replace("-", " ")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "war-room" && (
              <>
                {simulatedOutageNodeId && (
                  <Button
                    onClick={handleClearOutage}
                    variant="outline"
                    size="sm"
                    className="font-mono text-[10px] border-[#c64545]/40 text-[#c64545] hover:bg-[#c64545]/10 animate-pulse"
                  >
                    Clear Outage
                  </Button>
                )}
                <Button
                  onClick={() => setShowTimeline(!showTimeline)}
                  variant="outline"
                  size="sm"
                  className={`font-mono text-[10px] border-[#e6dfd8] ${showTimeline ? "bg-[#efe9de]" : ""}`}
                >
                  <Clock className="w-3 h-3" />
                  {showTimeline ? "Hide Timeline" : "Timeline"}
                </Button>
              </>
            )}
            <Button
              onClick={handleLoadDemo}
              variant="outline"
              size="sm"
              className="font-mono text-[10px] border-[#cc785c]/40 text-[#cc785c] hover:bg-[#cc785c]/10 gap-1.5 shadow-xs"
            >
              <Database className="w-3 h-3" />
              Load Demo Data
            </Button>
            <Button
              onClick={loadGraph}
              disabled={loading}
              variant="outline"
              size="sm"
              className="font-mono text-[11px] tracking-wider shadow-sm border-[#e6dfd8] text-[#3d3d3a] hover:bg-[#f5f0e8]"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span>SYNC MEMORY</span>
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-[#faf9f5]/60 relative">
          {activeTab === "war-room" && (
            <div className="h-full flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#6c6a64]">
                  <Filter className="w-3 h-3" />
                  <span>Filter:</span>
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-[#faf9f5] border border-[#e6dfd8] rounded px-2 py-1 text-[10px] font-mono text-[#3d3d3a] focus:outline-none focus:border-[#cc785c] cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="service">Services</option>
                  <option value="incident">Incidents / Alerts</option>
                  <option value="mitigation">Mitigations</option>
                  <option value="adr">ADRs</option>
                </select>
                <select
                  value={filterCriticality}
                  onChange={(e) => setFilterCriticality(e.target.value)}
                  className="bg-[#faf9f5] border border-[#e6dfd8] rounded px-2 py-1 text-[10px] font-mono text-[#3d3d3a] focus:outline-none focus:border-[#cc785c] cursor-pointer"
                >
                  <option value="all">All Severities</option>
                  <option value="p0">P0</option>
                  <option value="p1">P1</option>
                  <option value="p2">P2</option>
                  <option value="critical">Critical</option>
                </select>
                <div className="text-[10px] font-mono text-[#6c6a64] ml-auto">
                  {filteredGraphData.nodes.length} nodes /{" "}
                  {filteredGraphData.links.length} links
                </div>
              </div>

              <div className="flex-1 flex gap-6 min-h-0">
                <div className="flex-1 relative border border-[#e6dfd8] rounded-lg overflow-hidden bg-[#faf9f5] shadow-sm">
                  {loading && graphData.nodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#faf9f5]/90 z-10 font-mono text-xs text-[#6c6a64] gap-2">
                      <Terminal className="w-4 h-4 animate-spin text-[#cc785c]" />
                      <span>Traversing triple-store neural layers...</span>
                    </div>
                  )}
                  <Graph3D
                    data={filteredGraphData}
                    onNodeClick={handleNodeClick}
                    hoveredNode={hoveredNode}
                    setHoveredNode={setHoveredNode}
                    simulatedOutageNodeId={simulatedOutageNodeId}
                    cascadeNodeIds={cascadeNodeIds}
                  />
                </div>
                <div className="w-[360px] shrink-0 h-full">
                  <InspectorPanel
                    selectedNode={selectedNode}
                    mitigationProposal={mitigationProposal}
                    onExecuteCommand={handleExecuteCommand}
                    executionResult={executionResult}
                    isExecuting={isExecuting}
                    onForgetNode={handleForgetNode}
                    onToggleOutageSimulation={handleToggleOutageSimulation}
                    isOutageSimulated={
                      selectedNode
                        ? simulatedOutageNodeId === selectedNode.id
                        : false
                    }
                  />
                </div>
              </div>

              {showTimeline && (
                <div className="shrink-0 flex gap-4 h-[240px]">
                  <div className="flex-1 border border-[#e6dfd8] rounded-lg bg-[#faf9f5] flex flex-col p-4 shadow-sm">
                    <div className="text-xs font-mono font-bold text-[#141413] uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#cc785c]" />
                      Temporal Time Travel Filter
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      {temporalRange && temporalDate ? (
                        <div className="w-full">
                          <TemporalSlider
                            minDate={temporalRange.min}
                            maxDate={temporalRange.max}
                            currentDate={temporalDate}
                            onChange={setTemporalDate}
                          />
                        </div>
                      ) : (
                        <div className="text-[10px] font-mono text-[#6c6a64] text-center">
                          No temporal data available to travel through.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-[360px] overflow-hidden flex flex-col shrink-0">
                    <TemporalTimeline
                      graphData={graphData}
                      currentDate={temporalDate}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "ingest" && (
            <div className="max-w-4xl mx-auto h-full">
              <IncidentControl
                onRefresh={loadGraph}
                nodeCount={graphData.nodes.length}
                linkCount={graphData.links.length}
              />
            </div>
          )}

          {activeTab === "copilot" && (
            <div className="max-w-4xl mx-auto h-full flex flex-col gap-6">
              <div className="flex-1 min-h-0 bg-[#faf9f5] border border-[#e6dfd8] rounded-lg shadow-sm">
                <SRECopilot
                  sessionId={sessionId}
                  searchType={searchType}
                  setSearchType={setSearchType}
                  onMitigationProposal={setMitigationProposal}
                  onAddFeedback={handleFeedbackOverride}
                  onVoiceCommandTriggered={handleVoiceCommandTriggered}
                />
              </div>
              {mitigationProposal && (
                <div className="p-4 bg-[#faf9f5] border border-[#e6dfd8] rounded-lg shadow-sm shrink-0 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-[#cc785c] font-bold uppercase tracking-wider">
                      Active Mitigation Proposal
                    </div>
                    <div className="text-xs text-[#3d3d3a]">
                      {mitigationProposal.description}
                    </div>
                    <div className="text-[10px] font-mono text-[#6c6a64]">
                      Command: {mitigationProposal.command}
                    </div>
                  </div>
                  <Button
                    onClick={() =>
                      handleExecuteCommand(mitigationProposal.command)
                    }
                    disabled={isExecuting}
                    className="bg-[#cc785c] hover:bg-[#a9583e] active:bg-[#8e4731] text-white font-mono text-xs shadow-sm"
                  >
                    {isExecuting ? "Executing..." : "Execute Mitigation"}
                  </Button>
                </div>
              )}
              {executionResult && (
                <div className="bg-[#181715] text-[#a09d96] border border-[#252320] p-4 rounded-lg font-mono text-xs max-h-[160px] overflow-y-auto shadow-inner">
                  <div className="text-[#6c6a64] border-b border-[#252320] pb-1 mb-2">
                    Terminal STDOUT / STDERR Execution Output
                  </div>
                  <pre className="whitespace-pre-wrap">
                    {executionResult.stdout || executionResult.stderr}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === "agents" && (
            <div className="max-w-5xl mx-auto h-full">
              <AgentInvocationPanel />
            </div>
          )}

          {activeTab === "audit" && (
            <div className="max-w-6xl mx-auto h-full">
              <AuditDeck
                feedbackList={feedbackList}
                nodeCount={graphData.nodes.length}
                linkCount={graphData.links.length}
                healthStats={healthStats}
              />
            </div>
          )}

          {activeTab === "refinery" && (
            <div className="max-w-5xl mx-auto h-full">
              <CognitiveRefinery />
            </div>
          )}

          {activeTab === "compare" && (
            <div className="max-w-6xl mx-auto h-full">
              <CompareView />
            </div>
          )}

          {activeTab === "lineage" && (
            <div className="flex h-full gap-6">
              <div className="w-[400px] shrink-0 h-full border border-[#e6dfd8] rounded-lg bg-[#faf9f5] shadow-sm">
                <ProvenanceExplorer nodeId={selectedNode?.id || null} />
              </div>
              <div className="flex-1 relative border border-[#e6dfd8] rounded-lg overflow-hidden bg-[#faf9f5] shadow-sm">
                <Graph3D
                  data={filteredGraphData}
                  onNodeClick={handleNodeClick}
                  hoveredNode={hoveredNode}
                  setHoveredNode={setHoveredNode}
                />
                {!selectedNode && (
                  <div className="absolute top-4 left-4 right-4 bg-[#cc785c]/10 border border-[#cc785c]/30 text-[#cc785c] px-4 py-2 rounded-md text-sm font-mono text-center backdrop-blur-sm pointer-events-none">
                    Click a node to view its origin lineage
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <SidebarProvider>
        <DashboardContent />
      </SidebarProvider>
    </ErrorBoundary>
  );
}
