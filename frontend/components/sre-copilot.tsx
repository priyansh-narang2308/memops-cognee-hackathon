/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { submitQuery, submitFeedback } from "@/lib/api";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  ThumbsUp,
  ThumbsDown,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  text: string;
  traces?: Array<{ step: string; details?: string }>;
  mitigation_proposal?: { description: string; command: string } | null;
  rated?: boolean;
}

interface SRECopilotProps {
  sessionId: string;
  searchType: string;
  setSearchType: (type: string) => void;
  onMitigationProposal: (
    proposal: { description: string; command: string } | null,
  ) => void;
  onAddFeedback?: (score: number, comment: string) => void;
  onVoiceCommandTriggered?: (command: string, args?: any) => void;
}

export default function SRECopilot({
  sessionId,
  searchType,
  setSearchType,
  onMitigationProposal,
  onAddFeedback,
  onVoiceCommandTriggered,
}: SRECopilotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [feedbackMsgIndex, setFeedbackMsgIndex] = useState<number | null>(null);
  const [feedbackScore, setFeedbackScore] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [activeTraces, setActiveTraces] = useState<Array<{
    step: string;
    details?: string;
  }> | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  function handleLocalVoiceCommand(text: string): boolean {
    if (!onVoiceCommandTriggered) return false;
    const cleanText = text.toLowerCase().trim();

    if (
      cleanText.includes("simulate") &&
      (cleanText.includes("outage") ||
        cleanText.includes("failure") ||
        cleanText.includes("crash"))
    ) {
      let target = "";
      if (cleanText.includes("database") || cleanText.includes("db"))
        target = "User-DB";
      else if (cleanText.includes("gateway")) target = "user-gateway";
      else if (cleanText.includes("payment")) target = "payment-gateway";

      if (target) {
        onVoiceCommandTriggered("simulate-outage", { nodeName: target });
        speakResponse(`Simulating outage on ${target}`);
        setMessages((prev) => [
          ...prev,
          { role: "user", text: `Voice: Simulate outage on ${target}` },
          {
            role: "assistant",
            text: `Active Outage Simulation started for service: ${target}. Blast radius dependencies are highlighted in the 3D War Room.`,
          },
        ]);
        return true;
      }
    }

    if (
      cleanText.includes("clear outage") ||
      cleanText.includes("stop simulation") ||
      cleanText.includes("resolve outage") ||
      cleanText.includes("clear simulation")
    ) {
      onVoiceCommandTriggered("clear-outage");
      speakResponse(
        "Stopping active outage simulation and resetting dependency states.",
      );
      setMessages((prev) => [
        ...prev,
        { role: "user", text: "Voice: Clear outage" },
        {
          role: "assistant",
          text: "Active Outage Simulation stopped. Operational graphs restored to standard bounds.",
        },
      ]);
      return true;
    }

    if (
      cleanText.includes("sync memory") ||
      cleanText.includes("refresh graph") ||
      cleanText.includes("reload graph")
    ) {
      onVoiceCommandTriggered("sync-memory");
      speakResponse(
        "Syncing frontend graph representation with Cognee core database.",
      );
      setMessages((prev) => [
        ...prev,
        { role: "user", text: "Voice: Sync memory" },
        {
          role: "assistant",
          text: "Syncing 3D topological map of incident memories from Cognee core layers...",
        },
      ]);
      return true;
    }

    return false;
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-US";
        rec.onstart = () => setIsListening(true);
        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputVal(transcript);
          if (handleLocalVoiceCommand(transcript)) {
            return;
          }
          triggerSend(transcript);
        };
        rec.onerror = () => setIsListening(false);
        rec.onend = () => setIsListening(false);
        recognitionRef.current = rec;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchType, onVoiceCommandTriggered]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error(
        "Browser speech recognition is not supported in this browser.",
      );
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  async function triggerSend(queryText: string) {
    if (!queryText.trim()) return;

    if (handleLocalVoiceCommand(queryText)) {
      setInputVal("");
      return;
    }

    const userMsg: Message = { role: "user", text: queryText };
    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setIsLoading(true);
    try {
      const response = await submitQuery(queryText, searchType, sessionId);
      const textResponse =
        response.result || "No records retrieved from SRE memory.";
      const assistantMsg: Message = {
        role: "assistant",
        text: textResponse,
        traces: response.traces || [],
        mitigation_proposal: response.mitigation_proposal || null,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      onMitigationProposal(response.mitigation_proposal || null);
      if (response.mitigation_proposal) {
        speakResponse(
          `Found mitigation candidate: ${response.mitigation_proposal.description}`,
        );
      } else {
        speakResponse(textResponse);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Query error: ${msg}` },
      ]);
      toast.error(`Query failed: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerSend(inputVal);
  };

  function speakResponse(text: string) {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[`*#]/g, "");
      const utterance = new SpeechSynthesisUtterance(cleanText);
      window.speechSynthesis.speak(utterance);
    }
  }

  const handleFeedbackRate = (index: number, score: number) => {
    setFeedbackMsgIndex(index);
    setFeedbackScore(score);
    setFeedbackComment("");
  };

  const submitFeedbackData = async () => {
    if (feedbackMsgIndex === null) return;
    try {
      await submitFeedback(sessionId, feedbackScore, feedbackComment);
      setMessages((prev) =>
        prev.map((msg, i) =>
          i === feedbackMsgIndex ? { ...msg, rated: true } : msg,
        ),
      );
      toast.success("Feedback recorded in Cognee memory graph!");
      if (onAddFeedback) onAddFeedback(feedbackScore, feedbackComment);
      setFeedbackMsgIndex(null);
    } catch (e: unknown) {
      toast.error(
        `Feedback submission failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#faf9f5] border border-[#e6dfd8] rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b border-[#e6dfd8] bg-[#f5f0e8] flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-sm font-semibold tracking-wider text-[#141413] uppercase font-mono">
          Investigation Console
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-mono text-[#6c6a64] uppercase">
            Engine:
          </label>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="text-xs bg-[#faf9f5] border border-[#e6dfd8] rounded px-2.5 py-1 text-[#3d3d3a] font-mono focus:outline-none focus:border-[#cc785c]"
          >
            <option value="GRAPH_COMPLETION">GRAPH_COMPLETION</option>
            <option value="TEMPORAL">TEMPORAL</option>
            <option value="VECTOR_SEARCH">VECTOR_SEARCH</option>
            <option value="RAG_COMPLETION">RAG_COMPLETION</option>
            <option value="TRIPLET_COMPLETION">TRIPLET_COMPLETION</option>
            <option value="GRAPH_COMPLETION_COT">GRAPH_COMPLETION_COT</option>
            <option value="GRAPH_COMPLETION_DECOMPOSITION">
              GRAPH_COMPLETION_DECOMPOSITION
            </option>
            <option value="NATURAL_LANGUAGE">NATURAL_LANGUAGE</option>
            <option value="SUMMARIES">SUMMARIES</option>
            <option value="HYBRID_COMPLETION">HYBRID_COMPLETION</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#6c6a64] font-mono text-xs text-center min-h-[160px]">
            <span>Issue verbal or typed queries. E.g.:</span>
            <span className="text-[#cc785c] font-semibold mt-2">
              &quot;Explain failure dependencies for db_service&quot;
            </span>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col gap-2 max-w-[85%] ${msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}
            >
              <div
                className={`p-3 text-sm rounded-lg leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#cc785c] text-white rounded-tr-none shadow-sm"
                    : "bg-[#f5f0e8] border border-[#e6dfd8] text-[#141413] rounded-tl-none shadow-sm"
                }`}
              >
                <div className="whitespace-pre-wrap font-sans text-xs">
                  {msg.text}
                </div>
                {msg.role === "assistant" && (
                  <div className="flex items-center justify-between border-t border-[#e6dfd8]/80 mt-2.5 pt-2 gap-4">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => speakResponse(msg.text)}
                        className="text-[#6c6a64] hover:text-[#cc785c] transition"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      {msg.traces && msg.traces.length > 0 && (
                        <button
                          onClick={() => setActiveTraces(msg.traces || null)}
                          className="text-[#6c6a64] hover:text-[#cc785c] transition flex items-center gap-1 text-[10px] font-mono"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Show Trace ({msg.traces.length})</span>
                        </button>
                      )}
                    </div>
                    {!msg.rated && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleFeedbackRate(index, 5)}
                          className="text-[#6c6a64] hover:text-[#5db872] transition"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleFeedbackRate(index, 1)}
                          className="text-[#6c6a64] hover:text-[#c64545] transition"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-2 items-center justify-start max-w-[85%]">
            <div className="bg-[#f5f0e8] border border-[#e6dfd8] text-[#6c6a64] rounded-lg p-3 font-mono text-xs rounded-tl-none flex items-center gap-2 shadow-sm">
              <span className="w-1.5 h-1.5 bg-[#cc785c] rounded-full animate-ping" />
              <span>Traversing knowledge graph...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {feedbackMsgIndex !== null && (
        <div className="p-3 bg-[#f5f0e8] border-t border-[#e6dfd8] space-y-2 animate-in fade-in">
          <div className="text-[10px] font-mono text-[#6c6a64] uppercase">
            Adjust retrieving weights (feedback score:{" "}
            {feedbackScore === 5 ? "Good" : "Bad"})
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="What could be improved? e.g., missing redis link"
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              className="flex-1 bg-[#faf9f5] border border-[#e6dfd8] rounded px-2.5 py-1 text-xs text-[#141413] focus:outline-none focus:border-[#cc785c]"
            />
            <Button
              onClick={submitFeedbackData}
              size="sm"
              className="bg-[#cc785c] hover:bg-[#a9583e] text-white font-mono text-[10px] shadow-sm"
            >
              Submit
            </Button>
            <Button
              onClick={() => setFeedbackMsgIndex(null)}
              variant="outline"
              size="sm"
              className="border-[#e6dfd8] text-[#3d3d3a] hover:bg-[#efe9de] font-mono text-[10px]"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {activeTraces && (
        <div className="p-3 bg-[#f5f0e8] border-t border-[#e6dfd8] space-y-2 max-h-[160px] overflow-y-auto animate-in slide-in-from-bottom">
          <div className="flex justify-between items-center border-b border-[#e6dfd8] pb-1.5">
            <span className="text-[10px] font-mono text-[#6c6a64] uppercase tracking-wide">
              Reasoning Trace Chain
            </span>
            <button
              onClick={() => setActiveTraces(null)}
              className="text-[10px] font-mono text-[#6c6a64] hover:text-[#141413]"
            >
              Close
            </button>
          </div>
          <div className="space-y-1.5 text-[11px] font-mono text-[#6c6a64]">
            {activeTraces.map((trace, idx) => (
              <div key={idx} className="border-l border-[#e6dfd8] pl-2">
                <span className="text-[#8e8b82]">[{trace.step}]</span>{" "}
                {trace.details || "Processed node link"}
              </div>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={handleFormSubmit}
        className="p-3 bg-[#f5f0e8] border-t border-[#e6dfd8] flex gap-2 items-center"
      >
        <button
          type="button"
          onClick={toggleListening}
          className={`p-2.5 rounded-full transition ${
            isListening
              ? "bg-[#c64545] text-white animate-pulse"
              : "bg-[#efe9de] hover:bg-[#e6dfd8] text-[#6c6a64]"
          }`}
        >
          {isListening ? (
            <Mic className="w-4 h-4" />
          ) : (
            <MicOff className="w-4 h-4" />
          )}
        </button>
        <input
          type="text"
          placeholder="Query incident timeline / dependencies..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          className="flex-1 bg-[#faf9f5] border border-[#e6dfd8] rounded-full px-4 py-2 text-xs text-[#141413] focus:outline-none focus:border-[#cc785c]"
        />
        <button
          type="submit"
          disabled={isLoading || !inputVal.trim()}
          className="p-2.5 bg-[#cc785c] hover:bg-[#a9583e] active:bg-[#8e4731] text-white rounded-full transition disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
