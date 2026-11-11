"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  GitBranch,
  Play,
  Save,
  Plus,
  Trash2,
  Settings,
  Sparkles,
  HeartHandshake,
  Bot,
  MessageSquare,
  Clock,
  UserCheck,
  CheckCircle,
  HelpCircle,
  Send,
  RotateCcw,
  Download,
  Upload,
  Check,
  ChevronRight,
  ArrowRight,
  Zap,
  Sliders,
  Filter,
  Layers,
  X,
  AlertCircle,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Business, BusinessMember } from "@/types/database";
import { FlowEdge, FlowNode, FlowNodeType, VisualFlow } from "@/types/flows";
import {
  saveFlowAction,
  toggleFlowStatusAction,
  deleteFlowAction,
  loadFlowTemplateAction,
} from "@/app/actions/flows";
import { PREBUILT_FLOW_TEMPLATES } from "@/lib/flows/templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface FlowBuilderClientProps {
  business: Business;
  initialFlows: VisualFlow[];
}

export function FlowBuilderClient({
  business,
  initialFlows,
}: FlowBuilderClientProps) {
  const isAstrology = business.slug === "astrology";
  const [flows, setFlows] = useState<VisualFlow[]>(initialFlows);
  const [selectedFlowId, setSelectedFlowId] = useState<string>(
    initialFlows.length > 0 ? initialFlows[0].id : "new"
  );

  // Active Flow State
  const activeFlow = useMemo(() => {
    return (
      flows.find((f) => f.id === selectedFlowId) ||
      flows[0] || {
        id: "flow-scratch",
        business_id: business.id,
        name: isAstrology ? "Astrology Consultation Flow" : "Vivaham Onboarding Flow",
        description: "Custom visual conversation flow",
        trigger_keyword: null,
        status: "draft" as const,
        flow_type: "keyword" as const,
        nodes: [] as FlowNode[],
        edges: [] as FlowEdge[],
        viewport: { x: 0, y: 0, zoom: 1 },
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );
  }, [flows, selectedFlowId, business.id, isAstrology]);

  const [nodes, setNodes] = useState<FlowNode[]>(activeFlow.nodes || []);
  const [edges, setEdges] = useState<FlowEdge[]>(activeFlow.edges || []);
  const [flowName, setFlowName] = useState<string>(activeFlow.name);
  const [flowDescription, setFlowDescription] = useState<string>(
    activeFlow.description || ""
  );
  const [isActive, setIsActive] = useState<boolean>(activeFlow.is_active);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // UI state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [activeHighlightedNodeId, setActiveHighlightedNodeId] = useState<string | null>(null);

  // Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [connectingSource, setConnectingSource] = useState<{
    nodeId: string;
    handle?: string;
  } | null>(null);

  // WhatsApp Simulator Messages State
  const [simulatorMessages, setSimulatorMessages] = useState<
    Array<{ id: string; sender: "user" | "bot"; text: string; time: string }>
  >([
    {
      id: "sim-1",
      sender: "bot",
      text: isAstrology
        ? "Vanakkam! Welcome to Gokul's Astrological Insights. How can we guide your planetary consultation today?"
        : "Vanakkam! Welcome to Gokul Vivaham Matrimony. Let us know how we can assist with your partner search.",
      time: "Just now",
    },
  ]);
  const [simulatorInput, setSimulatorInput] = useState<string>("");

  // Sync state when selected flow changes
  useEffect(() => {
    const f = flows.find((item) => item.id === selectedFlowId);
    if (f) {
      setNodes(f.nodes || []);
      setEdges(f.edges || []);
      setFlowName(f.name);
      setFlowDescription(f.description || "");
      setIsActive(f.is_active);
      setSelectedNodeId(null);
    }
  }, [selectedFlowId, flows]);

  // Selected Node Data
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Dragging node handlers
  const handleMouseDownNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setDraggingNodeId(nodeId);
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setDragOffset({
        x: e.clientX - node.position.x,
        y: e.clientY - node.position.y,
      });
    }
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      const newX = Math.max(20, e.clientX - dragOffset.x);
      const newY = Math.max(20, e.clientY - dragOffset.y);

      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n
        )
      );
    }
  };

  const handleMouseUpCanvas = () => {
    setDraggingNodeId(null);
    setConnectingSource(null);
  };

  // Node operations
  const handleAddNode = (type: FlowNodeType) => {
    const newId = `node-${Date.now().toString(36)}`;
    const count = nodes.length;
    const defaultPosition = { x: 100 + (count % 4) * 80, y: 100 + (count % 4) * 80 };

    let newTitle = "New Node";
    let defaultConfig: any = {};

    switch (type) {
      case "trigger":
        newTitle = "Inbound Trigger";
        defaultConfig = {
          triggerType: "keyword",
          keywords: isAstrology ? ["horoscope", "jathagam"] : ["vivaham", "matrimony"],
          matchType: "contains",
        };
        break;
      case "message":
        newTitle = "WhatsApp Message";
        defaultConfig = {
          messageText: "Hello! We have received your message. Please share your details.",
        };
        break;
      case "condition":
        newTitle = "Business Hours Check";
        defaultConfig = {
          conditionType: "business_hours",
          operator: "in_hours",
        };
        break;
      case "interactive":
        newTitle = "Quick Reply Buttons";
        defaultConfig = {
          interactiveType: "quick_reply",
          messageText: "Please choose one of the options below:",
          buttons: [
            { id: "btn-1", title: "Option 1" },
            { id: "btn-2", title: "Option 2" },
          ],
        };
        break;
      case "action":
        newTitle = "Assign to Agent";
        defaultConfig = {
          actionType: "assign_agent",
          agentName: isAstrology ? "Gokul (Astrologer)" : "Matchmaking Team",
          crmStage: "contacted",
        };
        break;
      case "delay":
        newTitle = "Follow-up Delay";
        defaultConfig = {
          delayMinutes: 30,
        };
        break;
    }

    const newNode: FlowNode = {
      id: newId,
      type,
      position: defaultPosition,
      data: {
        title: newTitle,
        description: `Configured ${type} step`,
        config: defaultConfig,
      },
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newId);
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  // Connect ports
  const handleConnectPort = (targetNodeId: string) => {
    if (!connectingSource || connectingSource.nodeId === targetNodeId) {
      setConnectingSource(null);
      return;
    }

    const edgeId = `e-${connectingSource.nodeId}-${targetNodeId}-${Date.now().toString(36)}`;
    const newEdge: FlowEdge = {
      id: edgeId,
      source: connectingSource.nodeId,
      sourceHandle: connectingSource.handle,
      target: targetNodeId,
      label: connectingSource.handle === "true" ? "Yes" : connectingSource.handle === "false" ? "No" : undefined,
    };

    setEdges((prev) => {
      // Avoid duplicate connections
      const exists = prev.some(
        (e) =>
          e.source === newEdge.source &&
          e.target === newEdge.target &&
          e.sourceHandle === newEdge.sourceHandle
      );
      if (exists) return prev;
      return [...prev, newEdge];
    });

    setConnectingSource(null);
  };

  const handleDeleteEdge = (edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  };

  // Node Inspector configuration update
  const handleUpdateNodeConfig = (updatedConfig: any, title?: string, description?: string) => {
    if (!selectedNodeId) return;

    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === selectedNodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              title: title ?? n.data.title,
              description: description ?? n.data.description,
              config: {
                ...n.data.config,
                ...updatedConfig,
              },
            },
          };
        }
        return n;
      })
    );
  };

  // Save Flow
  const handleSaveFlow = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const flowData: Partial<VisualFlow> & { name: string } = {
      id: activeFlow.id.startsWith("temp-") || activeFlow.id.startsWith("flow-scratch") ? undefined : activeFlow.id,
      name: flowName,
      description: flowDescription,
      status: isActive ? "published" : "draft",
      is_active: isActive,
      nodes,
      edges,
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const res = await saveFlowAction(business.slug, flowData);
    setIsSaving(false);

    if (res.success && res.data) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      setFlows((prev) => {
        const idx = prev.findIndex((f) => f.id === res.data.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = res.data;
          return next;
        }
        return [res.data, ...prev];
      });
      setSelectedFlowId(res.data.id);
    } else {
      alert(`Save failed: ${res.error || "Unknown error"}`);
    }
  };

  // Load Pre-built Template
  const handleLoadTemplate = async (templateId: string) => {
    const t = PREBUILT_FLOW_TEMPLATES.find((item) => item.id === templateId);
    if (!t) return;

    setNodes(t.nodes);
    setEdges(t.edges);
    setFlowName(t.name);
    setFlowDescription(t.description);
    setShowTemplateModal(false);
    setSelectedNodeId(null);
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(
        JSON.stringify(
          {
            name: flowName,
            description: flowDescription,
            businessSlug: business.slug,
            nodes,
            edges,
          },
          null,
          2
        )
      );
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${business.slug}-flow-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Simulator Execution Step
  const handleSendSimulatorMessage = () => {
    if (!simulatorInput.trim()) return;

    const userText = simulatorInput.trim();
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Append user message
    setSimulatorMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, sender: "user", text: userText, time: timeNow },
    ]);
    setSimulatorInput("");

    // Simulate Node Traversal
    const lower = userText.toLowerCase();

    // 1. Find trigger node matching input
    const triggerNode = nodes.find((n) => {
      if (n.type !== "trigger") return false;
      const kws = n.data.config.keywords || [];
      return kws.some((k) => lower.includes(k.toLowerCase()));
    });

    if (triggerNode) {
      // Highlight trigger
      setActiveHighlightedNodeId(triggerNode.id);

      // Find next connected message node
      const edge = edges.find((e) => e.source === triggerNode.id);
      if (edge) {
        const nextNode = nodes.find((n) => n.id === edge.target);

        setTimeout(() => {
          if (nextNode) {
            setActiveHighlightedNodeId(nextNode.id);

            let replyText =
              nextNode.data.config.messageText ||
              "Automated response from conversation flow.";

            // If interactive buttons present, append option labels
            if (nextNode.data.config.buttons && nextNode.data.config.buttons.length > 0) {
              const btnTitles = nextNode.data.config.buttons
                .map((b: any, i: number) => `[${i + 1}] ${b.title}`)
                .join("\n");
              replyText += `\n\nOptions:\n${btnTitles}`;
            }

            setSimulatorMessages((prev) => [
              ...prev,
              {
                id: `bot-${Date.now()}`,
                sender: "bot",
                text: replyText,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              },
            ]);
          }

          setTimeout(() => {
            setActiveHighlightedNodeId(null);
          }, 2000);
        }, 800);
      } else {
        setTimeout(() => {
          setActiveHighlightedNodeId(null);
        }, 1500);
      }
    } else {
      // Fallback response
      setTimeout(() => {
        setSimulatorMessages((prev) => [
          ...prev,
          {
            id: `bot-fallback-${Date.now()}`,
            sender: "bot",
            text: isAstrology
              ? "We received your inquiry. Type 'jathagam' or 'horoscope' to test the intake flow."
              : "We received your inquiry. Type 'vivaham' or 'matrimony' to test the onboarding flow.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }, 500);
    }
  };

  // Node Color & Icon Helper
  const getNodeStyle = (type: FlowNodeType, isSelected: boolean, isHighlighted: boolean) => {
    let headerBg = "bg-slate-100 text-slate-800 border-slate-300";
    let icon = Bot;

    switch (type) {
      case "trigger":
        headerBg = "bg-emerald-500 text-white";
        icon = Zap;
        break;
      case "message":
        headerBg = "bg-blue-600 text-white";
        icon = MessageSquare;
        break;
      case "condition":
        headerBg = "bg-amber-500 text-white";
        icon = Filter;
        break;
      case "interactive":
        headerBg = "bg-indigo-600 text-white";
        icon = Sliders;
        break;
      case "action":
        headerBg = "bg-purple-600 text-white";
        icon = UserCheck;
        break;
      case "delay":
        headerBg = "bg-cyan-600 text-white";
        icon = Clock;
        break;
    }

    const ring = isHighlighted
      ? "ring-4 ring-emerald-400 shadow-xl shadow-emerald-500/20 animate-pulse scale-105"
      : isSelected
      ? "ring-2 ring-indigo-600 shadow-lg"
      : "shadow-md hover:shadow-lg";

    return { headerBg, icon, ring };
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] bg-slate-50 overflow-hidden relative">
      {/* Top Flow Header & Action Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs z-20">
        <div className="flex items-center gap-3">
          <div
            className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
              isAstrology ? "bg-purple-600 text-white" : "bg-rose-600 text-white"
            }`}
          >
            <GitBranch className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                className="text-base font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1"
                placeholder="Flow Name..."
              />
              <Badge
                variant={isActive ? "success" : "outline"}
                className="text-[10px] cursor-pointer"
                onClick={() => setIsActive(!isActive)}
              >
                {isActive ? "Active / Live" : "Draft / Paused"}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 px-1 truncate max-w-md">
              {flowDescription || "Visual drag-and-drop conversation builder"}
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplateModal(true)}
            className="text-xs flex items-center gap-1.5"
          >
            <Layers className="h-3.5 w-3.5 text-indigo-600" />
            <span>Templates</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            className="text-xs flex items-center gap-1.5"
            title="Export Flow as JSON"
          >
            <Download className="h-3.5 w-3.5 text-slate-600" />
            <span>Export</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSimulator(!showSimulator)}
            className={`text-xs flex items-center gap-1.5 ${
              showSimulator ? "bg-indigo-50 text-indigo-700 border-indigo-200" : ""
            }`}
          >
            <Play className="h-3.5 w-3.5 text-emerald-600" />
            <span>Test Simulator</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSaveFlow}
            disabled={isSaving}
            className="text-xs flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white min-w-[90px]"
          >
            {saveSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? "Saving..." : "Save Flow"}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Builder Work Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Floating Add Node Palette (Left side) */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 bg-white/95 backdrop-blur-md p-2 rounded-xl border border-slate-200 shadow-md">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
            Add Step
          </div>
          <button
            type="button"
            onClick={() => handleAddNode("trigger")}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
          >
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Trigger</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddNode("message")}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span>Message</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddNode("condition")}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
          >
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Condition</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddNode("interactive")}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
          >
            <div className="h-2 w-2 rounded-full bg-indigo-500" />
            <span>Buttons / Menu</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddNode("action")}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
          >
            <div className="h-2 w-2 rounded-full bg-purple-500" />
            <span>Agent Action</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddNode("delay")}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-cyan-50 hover:text-cyan-700 transition-colors"
          >
            <div className="h-2 w-2 rounded-full bg-cyan-500" />
            <span>Wait Delay</span>
          </button>
        </div>

        {/* Node Canvas Area */}
        <div
          className="flex-1 overflow-auto relative cursor-grab active:cursor-grabbing bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]"
          onMouseMove={handleMouseMoveCanvas}
          onMouseUp={handleMouseUpCanvas}
          onClick={() => {
            setSelectedNodeId(null);
            setConnectingSource(null);
          }}
        >
          {/* SVG Connection Lines Overlay */}
          <svg className="absolute inset-0 w-[3000px] h-[3000px] pointer-events-none z-0">
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#64748b" />
              </marker>
              <marker
                id="arrow-active"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#10b981" />
              </marker>
            </defs>

            {edges.map((edge) => {
              const sourceNode = nodes.find((n) => n.id === edge.source);
              const targetNode = nodes.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const x1 = sourceNode.position.x + 240;
              const y1 = sourceNode.position.y + 60;
              const x2 = targetNode.position.x;
              const y2 = targetNode.position.y + 60;

              const dx = Math.abs(x2 - x1) * 0.5;
              const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
              const isEdgeActive =
                activeHighlightedNodeId === edge.source ||
                activeHighlightedNodeId === edge.target;

              return (
                <g key={edge.id} className="pointer-events-auto group">
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isEdgeActive ? "#10b981" : "#94a3b8"}
                    strokeWidth={isEdgeActive ? "3" : "2"}
                    strokeDasharray={isEdgeActive ? "4 4" : undefined}
                    className={isEdgeActive ? "animate-[dash_1s_linear_infinite]" : ""}
                    markerEnd={isEdgeActive ? "url(#arrow-active)" : "url(#arrow)"}
                  />
                  {/* Invisible thicker stroke for clicking to delete */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="12"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Disconnect this path?")) {
                        handleDeleteEdge(edge.id);
                      }
                    }}
                  />
                  {edge.label && (
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 8}
                      fill="#64748b"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="bg-white px-1 select-none"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Render Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isHighlighted = activeHighlightedNodeId === node.id;
            const { headerBg, icon: NodeIcon, ring } = getNodeStyle(
              node.type,
              isSelected,
              isHighlighted
            );

            return (
              <div
                key={node.id}
                style={{
                  transform: `translate3d(${node.position.x}px, ${node.position.y}px, 0)`,
                }}
                onMouseDown={(e) => handleMouseDownNode(e, node.id)}
                onClick={(e) => e.stopPropagation()}
                className={`absolute w-60 rounded-xl bg-white border border-slate-200 select-none transition-shadow z-10 ${ring}`}
              >
                {/* Node Card Header */}
                <div
                  className={`px-3 py-2 rounded-t-xl flex items-center justify-between text-xs font-semibold ${headerBg}`}
                >
                  <div className="flex items-center gap-1.5">
                    <NodeIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate max-w-[130px]">{node.data.title}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNode(node.id);
                    }}
                    className="opacity-70 hover:opacity-100 p-0.5 rounded transition-opacity"
                    title="Delete Node"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Node Card Body Preview */}
                <div className="p-3 text-xs space-y-2 text-slate-600 bg-white rounded-b-xl relative">
                  {/* Left Target Connection Port */}
                  {node.type !== "trigger" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConnectPort(node.id);
                      }}
                      className={`absolute -left-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 bg-white flex items-center justify-center transition-transform hover:scale-125 ${
                        connectingSource
                          ? "border-emerald-500 bg-emerald-50 animate-bounce"
                          : "border-slate-400"
                      }`}
                      title="Click to connect from source node"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                    </button>
                  )}

                  {/* Body Content Details */}
                  {node.type === "trigger" && (
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Keywords
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(node.data.config.keywords || []).slice(0, 3).map((kw: string) => (
                          <span
                            key={kw}
                            className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200"
                          >
                            {kw}
                          </span>
                        ))}
                        {(node.data.config.keywords || []).length > 3 && (
                          <span className="text-[10px] text-slate-400">
                            +{(node.data.config.keywords || []).length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {node.type === "message" && (
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Message Preview
                      </div>
                      <p className="text-[11px] text-slate-700 line-clamp-2 mt-0.5 italic">
                        &ldquo;{node.data.config.messageText || "No text set"}&rdquo;
                      </p>
                    </div>
                  )}

                  {node.type === "condition" && (
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Branch Condition
                      </div>
                      <p className="text-[11px] font-semibold text-amber-700 mt-0.5">
                        {node.data.config.conditionType === "business_hours"
                          ? "Operating Hours (9 AM - 6 PM)"
                          : "Tamil / English Check"}
                      </p>
                    </div>
                  )}

                  {node.type === "interactive" && (
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Options
                      </div>
                      <div className="space-y-1 mt-1">
                        {(node.data.config.buttons || []).map((b: any) => (
                          <div
                            key={b.id}
                            className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-medium border border-indigo-200 flex items-center justify-between"
                          >
                            <span>{b.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {node.type === "action" && (
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Agent Assignment
                      </div>
                      <p className="text-[11px] font-semibold text-purple-700 mt-0.5">
                        {node.data.config.agentName || "Gokul"}
                      </p>
                    </div>
                  )}

                  {node.type === "delay" && (
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Timer
                      </div>
                      <p className="text-[11px] font-semibold text-cyan-700 mt-0.5">
                        Wait {node.data.config.delayMinutes || 15} minutes
                      </p>
                    </div>
                  )}

                  {/* Right Source Connection Port */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConnectingSource({ nodeId: node.id });
                    }}
                    className={`absolute -right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 bg-white flex items-center justify-center transition-transform hover:scale-125 ${
                      connectingSource?.nodeId === node.id
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-400"
                    }`}
                    title="Click then click target node to connect"
                  >
                    <ArrowRight className="h-3 w-3 text-slate-600" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Node Inspector Drawer (Right Side when node is selected) */}
        {selectedNode && (
          <div className="w-80 border-l border-slate-200 bg-white p-4 overflow-y-auto shrink-0 shadow-lg z-20 animate-in slide-in-from-right duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Node Inspector
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                  {selectedNode.data.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {/* Node Title */}
              <div>
                <label className="text-xs font-semibold text-slate-700">Step Label</label>
                <input
                  type="text"
                  value={selectedNode.data.title}
                  onChange={(e) =>
                    handleUpdateNodeConfig(selectedNode.data.config, e.target.value)
                  }
                  className="mt-1 w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Trigger Configuration */}
              {selectedNode.type === "trigger" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Trigger Keywords (comma separated)
                    </label>
                    <textarea
                      rows={3}
                      value={(selectedNode.data.config.keywords || []).join(", ")}
                      onChange={(e) =>
                        handleUpdateNodeConfig({
                          ...selectedNode.data.config,
                          keywords: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="mt-1 w-full text-xs rounded-lg border border-slate-200 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="e.g. horoscope, jathagam, ஜாதகம்"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Case-insensitive keywords matching inbound WhatsApp messages.
                    </p>
                  </div>
                </div>
              )}

              {/* Message Configuration */}
              {selectedNode.type === "message" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      WhatsApp Message Text
                    </label>
                    <textarea
                      rows={6}
                      value={selectedNode.data.config.messageText || ""}
                      onChange={(e) =>
                        handleUpdateNodeConfig({
                          ...selectedNode.data.config,
                          messageText: e.target.value,
                        })
                      }
                      className="mt-1 w-full text-xs rounded-lg border border-slate-200 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Type WhatsApp message..."
                    />
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-slate-400">Variables:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const current = selectedNode.data.config.messageText || "";
                          handleUpdateNodeConfig({
                            ...selectedNode.data.config,
                            messageText: `${current} {{contact.name}}`,
                          });
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-mono"
                      >
                        &#123;&#123;contact.name&#125;&#125;
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Condition Configuration */}
              {selectedNode.type === "condition" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Evaluation Type
                    </label>
                    <select
                      value={selectedNode.data.config.conditionType || "business_hours"}
                      onChange={(e) =>
                        handleUpdateNodeConfig({
                          ...selectedNode.data.config,
                          conditionType: e.target.value,
                        })
                      }
                      className="mt-1 w-full text-xs rounded-lg border border-slate-200 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="business_hours">Business Hours (9 AM - 6 PM)</option>
                      <option value="keyword_contains">Keyword Contains</option>
                      <option value="crm_stage">Customer Stage</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Action Configuration */}
              {selectedNode.type === "action" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Assign to Agent
                    </label>
                    <input
                      type="text"
                      value={selectedNode.data.config.agentName || ""}
                      onChange={(e) =>
                        handleUpdateNodeConfig({
                          ...selectedNode.data.config,
                          agentName: e.target.value,
                        })
                      }
                      className="mt-1 w-full text-xs rounded-lg border border-slate-200 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. Gokul (Astrologer)"
                    />
                  </div>
                </div>
              )}

              {/* Delete Step */}
              <div className="pt-4 border-t border-slate-200">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  className="w-full text-xs flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove This Step</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Interactive WhatsApp Simulator Drawer */}
        {showSimulator && (
          <div className="w-80 sm:w-96 border-l border-slate-200 bg-slate-900 text-white flex flex-col shrink-0 shadow-2xl z-30 animate-in slide-in-from-right duration-200">
            {/* Phone Top Mockup Bar */}
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold leading-tight">{business.name}</h4>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online &bull; WhatsApp Bot
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setSimulatorMessages([
                      {
                        id: `sim-reset-${Date.now()}`,
                        sender: "bot",
                        text: "Chat cleared. Send a message to test your flow.",
                        time: "Now",
                      },
                    ])
                  }
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  title="Clear Simulator"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowSimulator(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Chat Bubble Area */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-slate-900">
              {simulatorMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.sender === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                      msg.sender === "user"
                        ? "bg-emerald-600 text-white rounded-br-none shadow-sm"
                        : "bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/60 shadow-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-slate-500 mt-0.5 px-1">{msg.time}</span>
                </div>
              ))}
            </div>

            {/* Simulator Input Box */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={simulatorInput}
                onChange={(e) => setSimulatorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendSimulatorMessage();
                }}
                placeholder="Type test keyword (e.g. jathagam)..."
                className="flex-1 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleSendSimulatorMessage}
                className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500 transition-colors shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pre-built Templates Modal */}
      {showTemplateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Pre-built Conversation Flow Templates
                </h3>
                <p className="text-xs text-slate-500">
                  Select a production-tested conversation workflow tailored for {business.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 mt-4 max-h-[60vh] overflow-y-auto">
              {PREBUILT_FLOW_TEMPLATES.filter(
                (t) => t.businessCategory === business.slug || t.businessCategory === "both"
              ).map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-200 p-4 hover:border-indigo-500 hover:shadow-sm transition-all flex items-start justify-between gap-4"
                >
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{t.name}</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {t.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                        {t.nodes.length} Steps
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">
                        {t.flow_type}
                      </span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleLoadTemplate(t.id)}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 mt-1"
                  >
                    Load Flow
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
