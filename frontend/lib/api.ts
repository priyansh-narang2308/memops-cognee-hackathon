/* eslint-disable @typescript-eslint/no-explicit-any */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

async function apiRequest<T>(
  path: string,
  method: string = "GET",
  body?: any,
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (API_KEY) {
    (headers as Record<string, string>)["X-API-Key"] = API_KEY;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }

  return response.json() as Promise<T>;
}

export interface GraphNode {
  id: string;
  name?: string;
  type?: string;
  attributes?: Record<string, any>;
  [key: string]: any;
}

export interface GraphLink {
  source: string;
  target: string;
  type?: string;
  attributes?: Record<string, any>;
  [key: string]: any;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface QueryResponse {
  result: string;
  traces?: Array<{
    step: string;
    details?: string;
    [key: string]: any;
  }>;
  mitigation_proposal?: {
    description: string;
    command: string;
  } | null;
  [key: string]: any;
}

export interface MitigationResponse {
  status: string;
  stdout: string;
  stderr: string;
  exit_code: number;
}

export interface GeneralResponse {
  status: string;
  message: string;
}

export interface MemoryHealthStats {
  dataset: string;
  graph?: {
    total_nodes: number;
    total_edges: number;
    node_type_breakdown: Record<string, number>;
  };
  memory_health: string;
  decay?: {
    decay_percentage: number;
    stale_node_count: number;
    total_node_count: number;
  };
  timestamps?: {
    oldest_ingested: string | null;
    newest_ingested: string | null;
  };
  error?: string;
}

export interface DecayStats {
  dataset: string;
  decay_percentage: number;
  total_nodes: number;
  stale_nodes: number;
  healthy_nodes: number;
  stale_details?: Array<{
    id: string;
    name: string;
    type: string;
    days_since_ingest: number | null;
    has_edges: boolean;
  }>;
}

export interface GrowthSnapshot {
  timestamp: string;
  dataset: string;
  nodes: number;
  edges: number;
}

export interface ImproveRun {
  timestamp: string;
  dataset: string;
  session_ids: string[];
}

export interface ImproveResponse {
  status: string;
  dataset: string;
  session_ids?: string[] | null;
  global_context_index: boolean;
}

export async function fetchGraph(
  dataset: string = "incidents",
): Promise<GraphData> {
  return apiRequest<GraphData>(
    `/graph?dataset=${encodeURIComponent(dataset)}`,
    "GET",
  );
}

export async function fetchHealthStats(
  dataset: string = "incidents",
): Promise<MemoryHealthStats> {
  return apiRequest<MemoryHealthStats>(
    `/health?dataset=${encodeURIComponent(dataset)}`,
    "GET",
  );
}

export async function fetchDecayStats(
  dataset: string = "incidents",
): Promise<DecayStats> {
  return apiRequest<DecayStats>(
    `/health/decay?dataset=${encodeURIComponent(dataset)}`,
    "GET",
  );
}

export async function fetchGrowthHistory(
  dataset: string = "incidents",
): Promise<{
  dataset: string;
  snapshots: GrowthSnapshot[];
  total_snapshots: number;
}> {
  return apiRequest(
    `/health/growth?dataset=${encodeURIComponent(dataset)}`,
    "GET",
  );
}

export async function fetchImproveHistory(
  limit: number = 20,
): Promise<{ improve_runs: ImproveRun[]; total_runs: number }> {
  return apiRequest(`/health/improve-runs?limit=${limit}`, "GET");
}

export async function submitIngest(
  text: string,
  dataset: string = "incidents",
  nodeSet?: string[],
  customPrompt?: string,
): Promise<any> {
  return apiRequest<any>("/ingest", "POST", {
    text,
    dataset,
    node_set: nodeSet,
    custom_prompt: customPrompt,
  });
}

export async function submitQuery(
  query: string,
  searchType: string,
  sessionId?: string,
): Promise<QueryResponse> {
  return apiRequest<QueryResponse>("/query", "POST", {
    query,
    search_type: searchType,
    session_id: sessionId,
  });
}

export async function executeMitigation(
  command: string,
): Promise<MitigationResponse> {
  return apiRequest<MitigationResponse>("/mitigate/execute", "POST", {
    command,
  });
}

export async function submitFeedback(
  sessionId: string,
  score: number,
  comment: string,
  dataset: string = "incidents",
): Promise<GeneralResponse> {
  return apiRequest<GeneralResponse>("/feedback", "POST", {
    session_id: sessionId,
    score,
    comment,
    dataset,
  });
}

export async function pruneMemory(
  dataset: string = "incidents",
  entityId?: string,
): Promise<GeneralResponse> {
  const path = entityId
    ? `/prune?dataset=${encodeURIComponent(dataset)}&entity_id=${encodeURIComponent(entityId)}`
    : `/prune?dataset=${encodeURIComponent(dataset)}`;
  return apiRequest<GeneralResponse>(path, "DELETE");
}

export async function registerAgentSession(
  agentSessionName: string,
  sessionId: string,
  datasets: string[] = ["incidents"],
): Promise<any> {
  return apiRequest<any>("/agents/session", "POST", {
    agent_session_name: agentSessionName,
    session_id: sessionId,
    datasets,
  });
}

export async function registerAgent(
  name: string,
  datasets: string[] = ["incidents"],
): Promise<any> {
  return apiRequest<any>("/agents/register", "POST", { name, datasets });
}

export async function invokeSreAgent(incidentText: string): Promise<any> {
  return apiRequest<any>("/agents/invoke/sre", "POST", {
    incident_text: incidentText,
  });
}

export async function invokePostmortemAgent(
  incidentText: string,
): Promise<any> {
  return apiRequest<any>("/agents/invoke/postmortem", "POST", {
    incident_text: incidentText,
  });
}

export async function uploadFileIngestion(
  file: File,
  dataset: string = "incidents",
  nodeSet?: string,
): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("dataset", dataset);
  if (nodeSet) {
    formData.append("node_set", nodeSet);
  }

  const headers: HeadersInit = {};
  if (API_KEY) {
    (headers as Record<string, string>)["X-API-Key"] = API_KEY;
  }

  const response = await fetch(`${API_URL}/ingest/file`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }

  return response.json();
}

export async function setupMultiUser(): Promise<any> {
  return apiRequest<any>("/admin/setup-multi-user", "POST");
}

export interface LineageData {
  document_id: string;
  chunk_id: string;
  ingested_at: string;
  raw_text_chunk: string;
  pipeline_tasks_run: string[];
  ontology_valid: boolean;
  storage: string;
}

export interface LineageResponse {
  node_id: string;
  name: string;
  type: string;
  lineage: LineageData;
}

export async function fetchLineage(
  nodeId: string,
  dataset: string = "incidents",
): Promise<LineageResponse> {
  return apiRequest<LineageResponse>(
    `/lineage/${encodeURIComponent(nodeId)}?dataset=${encodeURIComponent(dataset)}`,
    "GET",
  );
}

export async function runImprovement(
  dataset: string = "incidents",
  sessionIds?: string[],
  runInBackground: boolean = false,
): Promise<ImproveResponse> {
  return apiRequest<ImproveResponse>("/improve", "POST", {
    dataset,
    session_ids: sessionIds,
    run_in_background: runInBackground,
  });
}

export async function fetchProvenance(
  dataset: string = "incidents",
): Promise<any> {
  return apiRequest<any>(
    `/provenance?dataset=${encodeURIComponent(dataset)}`,
    "GET",
  );
}

export async function fetchSchemaInventory(): Promise<any> {
  return apiRequest<any>("/schema", "GET");
}

export async function summarizeIncident(
  text: string,
  incidentTitle: string = "",
): Promise<any> {
  return apiRequest<any>("/summarize", "POST", {
    text,
    incident_title: incidentTitle,
  });
}

export async function updateMemoryEntry(
  dataId: string,
  newData: string,
  dataset: string = "incidents",
): Promise<any> {
  return apiRequest<any>("/update", "PUT", {
    data_id: dataId,
    new_data: newData,
    dataset,
  });
}

export async function exportMemoryData(
  dataset: string = "incidents",
  format: string = "json",
): Promise<any> {
  return apiRequest<any>("/export", "POST", {
    dataset,
    format,
  });
}

export async function pushToDataset(
  data: string,
  targetDataset: string,
  sourceDataset: string = "incidents",
): Promise<any> {
  return apiRequest<any>("/push", "POST", {
    data,
    target_dataset: targetDataset,
    source_dataset: sourceDataset,
  });
}

export async function fetchObservabilityTraces(): Promise<any> {
  return apiRequest<any>("/observability/traces", "GET");
}

export async function clearObservabilityTraces(): Promise<any> {
  return apiRequest<any>("/observability/traces", "DELETE");
}

export async function loadDemoData(
  dataset: string = "incidents",
): Promise<any> {
  return apiRequest<any>(
    `/demo/load?dataset=${encodeURIComponent(dataset)}`,
    "POST",
  );
}

export async function compareStatelessVsCognee(question: string): Promise<any> {
  return apiRequest<any>("/demo/compare", "POST", { question });
}
