/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useEffect, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { GraphData, GraphNode } from "@/lib/api";

interface Graph3DProps {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  hoveredNode: GraphNode | null;
  setHoveredNode: (node: GraphNode | null) => void;
  simulatedOutageNodeId?: string | null;
  cascadeNodeIds?: Set<string>;
}

export default function Graph3D({
  data,
  onNodeClick,
  hoveredNode,
  setHoveredNode,
  simulatedOutageNodeId = null,
  cascadeNodeIds = new Set(),
}: Graph3DProps) {
  const graphRef = useRef<any>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<any>>(new Set());

  useEffect(() => {
    let animId: number;
    const tick = () => {
      const scale = 1 + 0.25 * Math.sin(Date.now() / 200);
      const opacity = 0.3 + 0.15 * Math.sin(Date.now() / 200);
      if (graphRef.current) {
        const scene = graphRef.current.scene();
        scene.traverse((obj: any) => {
          if (obj.name === "pulse") {
            obj.scale.set(scale, scale, scale);
            if (obj.material) {
              obj.material.opacity = opacity;
            }
          }
        });
      }
      animId = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    if (!hoveredNode) {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      return;
    }
    const adjacentNodes = new Set<string>([hoveredNode.id]);
    const adjacentLinks = new Set<any>();
    data.links.forEach((link) => {
      const sourceId =
        typeof link.source === "object" ? (link.source as any).id : link.source;
      const targetId =
        typeof link.target === "object" ? (link.target as any).id : link.target;
      if (sourceId === hoveredNode.id) {
        adjacentNodes.add(targetId);
        adjacentLinks.add(link);
      } else if (targetId === hoveredNode.id) {
        adjacentNodes.add(sourceId);
        adjacentLinks.add(link);
      }
    });
    setHighlightNodes(adjacentNodes);
    setHighlightLinks(adjacentLinks);
  }, [hoveredNode, data]);

  const isLinkFlow = (link: any) => {
    const sourceId =
      typeof link.source === "object" ? (link.source as any).id : link.source;
    const targetId =
      typeof link.target === "object" ? (link.target as any).id : link.target;

    if (!simulatedOutageNodeId) return false;

    const connectsToOutage =
      sourceId === simulatedOutageNodeId || targetId === simulatedOutageNodeId;
    const connectsToCascade =
      cascadeNodeIds.has(sourceId) || cascadeNodeIds.has(targetId);

    return connectsToOutage || connectsToCascade;
  };

  const getNodeThreeObject = (node: any) => {
    const group = new THREE.Group();
    const type = node.type || node.attributes?.type || "Unknown";

    let color = "#cc785c";
    let size = 6;

    const isOutageSource =
      simulatedOutageNodeId && node.id === simulatedOutageNodeId;
    const isCascaded = cascadeNodeIds && cascadeNodeIds.has(node.id);

    if (type === "Incident" || type === "Alert") {
      color = "#c64545";
      size = 8;
    } else if (type === "Mitigation") {
      color = "#cc785c";
      size = 6;
    } else if (type === "Service") {
      color = "#5db872";
      size = 7;
    } else if (type === "ArchitecturalDecision" || type === "ADR") {
      color = "#e8a55a";
      size = 6;
    }

    if (isOutageSource) {
      color = "#c64545";
      size = 11;
    } else if (isCascaded) {
      color = "#e8a55a";
      size = 8.5;
    }

    if (highlightNodes.has(node.id)) {
      size *= 1.35;
    }

    const sphereGeom = new THREE.SphereGeometry(size, 16, 16);
    const sphereMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.9,
    });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    group.add(sphere);

    if (
      type === "Incident" ||
      type === "Alert" ||
      isOutageSource ||
      isCascaded
    ) {
      const pulseGeom = new THREE.SphereGeometry(size * 1.6, 16, 16);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(
          isOutageSource ? "#c64545" : isCascaded ? "#e8a55a" : color,
        ),
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
      });
      const pulseMesh = new THREE.Mesh(pulseGeom, pulseMat);
      pulseMesh.name = "pulse";
      group.add(pulseMesh);
    }

    return group;
  };

  const handleNodeHover = (node: any) => {
    setHoveredNode(node);
  };

  const getNodeLabel = (node: any) => {
    const name = node.name || node.attributes?.name || node.id;
    const type = node.type || node.attributes?.type || "Unknown";
    const details = node.description || node.attributes?.description || "";
    const attrs = node.attributes || {};
    const isOutage = simulatedOutageNodeId && node.id === simulatedOutageNodeId;
    const isCascaded = cascadeNodeIds.has(node.id);

    const provenance = attrs.provenance;
    const ontology = attrs.ontology;
    const severity = attrs.severity;
    const criticality = attrs.criticality;
    const team = attrs.team;

    const tags = [];
    if (ontology?.ontology_valid)
      tags.push(
        `<span class="bg-[#5db872]/10 text-[#5db872] border border-[#5db872]/30 text-[9px] font-mono px-1 rounded">ONTOLOGY</span>`,
      );
    if (provenance?.source_type)
      tags.push(
        `<span class="bg-[#cc785c]/10 text-[#cc785c] border border-[#cc785c]/30 text-[9px] font-mono px-1 rounded uppercase">${provenance.source_type}</span>`,
      );
    if (severity)
      tags.push(
        `<span class="bg-[#c64545]/10 text-[#c64545] border border-[#c64545]/30 text-[9px] font-mono px-1 rounded">${severity}</span>`,
      );
    if (criticality)
      tags.push(
        `<span class="bg-[#e8a55a]/10 text-[#e8a55a] border border-[#e8a55a]/30 text-[9px] font-mono px-1 rounded">${criticality}</span>`,
      );
    if (team)
      tags.push(
        `<span class="bg-[#6c6a64]/10 text-[#6c6a64] border border-[#6c6a64]/30 text-[9px] font-mono px-1 rounded">${team}</span>`,
      );

    return `
      <div class="bg-[#faf9f5] border border-[#e6dfd8] shadow-lg rounded p-3 text-xs font-sans text-[#141413]" style="max-width:320px">
        <div class="font-bold text-[#141413] mb-1 flex items-center gap-1.5 flex-wrap">
          ${name}
          ${isOutage ? `<span class="bg-[#c64545] text-white text-[9px] font-mono px-1 rounded uppercase animate-pulse">CRASHED</span>` : ""}
          ${isCascaded ? `<span class="bg-[#e8a55a] text-[#141413] text-[9px] font-mono px-1 rounded uppercase">AT RISK</span>` : ""}
        </div>
        <div class="text-[#6c6a64] mb-1">Type: <span class="text-[#cc785c] font-mono font-semibold">${type}</span></div>
        ${tags.length ? `<div class="flex flex-wrap gap-1 mb-1">${tags.join(" ")}</div>` : ""}
        ${details ? `<div class="text-[#3d3d3a] max-w-xs mt-1 border-t border-[#e6dfd8] pt-1 leading-relaxed">${details}</div>` : ""}
        ${provenance?.ingested_at ? `<div class="text-[#6c6a64] mt-1 border-t border-[#e6dfd8] pt-1 text-[10px] font-mono">Ingested: ${new Date(provenance.ingested_at).toLocaleString()}</div>` : ""}
      </div>
    `;
  };

  return (
    <div className="relative w-full h-full min-h-[400px] bg-[#faf9f5] overflow-hidden border border-[#e6dfd8] rounded-lg">
      <ForceGraph3D
        ref={graphRef}
        graphData={data}
        nodeThreeObject={getNodeThreeObject}
        onNodeClick={onNodeClick}
        onNodeHover={handleNodeHover}
        nodeLabel={getNodeLabel}
        linkWidth={(link) => {
          if (highlightLinks.has(link)) return 3;
          if (isLinkFlow(link)) return 2.5;
          return 1;
        }}
        linkColor={(link) => {
          if (highlightLinks.has(link)) return "#cc785c";
          if (isLinkFlow(link)) return "#c64545";
          return "#e6dfd8";
        }}
        linkDirectionalParticles={(link) => {
          if (highlightLinks.has(link)) return 4;
          if (isLinkFlow(link)) return 6;
          return 0;
        }}
        linkDirectionalParticleWidth={(link) => {
          if (isLinkFlow(link)) return 3.5;
          return 2;
        }}
        linkDirectionalParticleSpeed={(link) => {
          if (isLinkFlow(link)) return 0.02;
          return 0.005;
        }}
        backgroundColor="#faf9f5"
        showNavInfo={false}
      />
      <div className="absolute bottom-4 left-4 bg-[#faf9f5]/90 backdrop-blur border border-[#e6dfd8] rounded p-3 text-[11px] font-mono text-[#6c6a64] space-y-1.5 pointer-events-none select-none shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#5db872]" />
          <span>Service</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#c64545]" />
          <span>Incident / Alert</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#cc785c]" />
          <span>Mitigation Task</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#e8a55a]" />
          <span>Decision (ADR)</span>
        </div>
        {simulatedOutageNodeId && (
          <div className="border-t border-[#e6dfd8] pt-1.5 mt-1 text-[9px] text-[#c64545] font-bold uppercase animate-pulse">
            ⚠️ Outage Simulation Active
          </div>
        )}
      </div>
    </div>
  );
}
