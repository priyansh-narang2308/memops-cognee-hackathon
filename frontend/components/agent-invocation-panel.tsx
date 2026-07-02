"use client";

import { useState, useEffect } from "react";
import { invokeSreAgent, invokePostmortemAgent, registerAgent, registerAgentSession } from "@/lib/api";
import {
  Bot,
  Play,
  Sparkles,
  Terminal,
  ShieldAlert,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AgentInvocationPanel() {
  const [incidentText, setIncidentText] = useState(
    "API Gateway 502 Bad Gateway spike across us-east-1 following Redis auth token rotation.",
  );
  const [activeAgent, setActiveAgent] = useState<"sre" | "postmortem">("sre");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const register = async () => {
      try {
        await registerAgent("on_call_sre", ["incidents"]);
        await registerAgent("post_mortem_analyzer", ["incidents"]);
      } catch {
        // Registration may fail if already registered — that's fine
      }
    };
    register();
  }, []);

  const handleInvoke = async () => {
    if (!incidentText.trim()) {
      toast.error("Please enter an incident description");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      toast.info(
        `Invoking @cognee.agent_memory decorated ${activeAgent.toUpperCase()} agent...`,
      );
      const res =
        activeAgent === "sre"
          ? await invokeSreAgent(incidentText)
          : await invokePostmortemAgent(incidentText);

      setResult(res);
      toast.success(
        `${activeAgent.toUpperCase()} Agent execution completed successfully!`,
      );
    } catch (e: unknown) {
      toast.error(
        `Agent execution failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6 p-6 bg-[#faf9f5] border border-[#e6dfd8] rounded-lg shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e6dfd8] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#cc785c]/10 text-[#cc785c] border border-[#cc785c]/20">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#141413]">
              Autonomous SRE Agent Invocation
            </h2>
            <p className="text-xs text-[#6c6a64]">
              Run AI agents powered by @cognee.agent_memory auto-injected
              historical graph context
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#efe9de] p-1 rounded-lg border border-[#e6dfd8]">
          <button
            onClick={() => {
              setActiveAgent("sre");
              setResult(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeAgent === "sre"
                ? "bg-white text-[#141413] shadow-sm"
                : "text-[#6c6a64] hover:text-[#141413]"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#cc785c]" />
            On-Call SRE Agent
          </button>
          <button
            onClick={() => {
              setActiveAgent("postmortem");
              setResult(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeAgent === "postmortem"
                ? "bg-white text-[#141413] shadow-sm"
                : "text-[#6c6a64] hover:text-[#141413]"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#cc785c]" />
            Post-Mortem Analyzer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-[#3d3d3a] flex items-center gap-2 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#cc785c]" />
            Incident Telemetry / Alert Payload
          </label>
          <textarea
            value={incidentText}
            onChange={(e) => setIncidentText(e.target.value)}
            placeholder="Paste alert log, Slack incident discussion, or pager alert payload..."
            className="w-full flex-1 min-h-[220px] p-4 bg-white border border-[#e6dfd8] rounded-lg text-xs font-mono text-[#141413] focus:outline-none focus:ring-2 focus:ring-[#cc785c]/30 resize-none shadow-inner"
          />
          <Button
            onClick={handleInvoke}
            disabled={loading}
            className="w-full bg-[#cc785c] hover:bg-[#a9583e] active:bg-[#8e4731] text-white font-mono text-xs shadow-sm h-10 gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Querying Knowledge Graph & Executing Agent...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Invoke {activeAgent === "sre"
                  ? "On-Call SRE"
                  : "Post-Mortem"}{" "}
                Agent
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-[#3d3d3a] flex items-center gap-2 uppercase tracking-wider">
            <Terminal className="w-3.5 h-3.5 text-[#6c6a64]" />
            Structured Agent Analysis Output
          </label>
          <div className="flex-1 min-h-[260px] bg-[#181715] text-[#a09d96] border border-[#252320] p-4 rounded-lg font-mono text-xs overflow-y-auto shadow-inner">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[#6c6a64]">
                <Loader2 className="w-6 h-6 animate-spin text-[#cc785c]" />
                <span>Injecting graph context via @cognee.agent_memory...</span>
              </div>
            ) : result ? (
              <pre className="whitespace-pre-wrap text-[#4ade80]">
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-[#6c6a64] italic">
                No output yet. Enter incident text and click Invoke to execute
                agent.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
