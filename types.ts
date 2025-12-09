
export interface HarHeader {
  name: string;
  value: string;
}

export interface HarPostData {
  mimeType: string;
  text?: string;
  params?: Array<{ name: string; value: string }>;
}

export interface HarContent {
  size: number;
  mimeType: string;
  text?: string;
  encoding?: string;
}

export interface HarRequest {
  method: string;
  url: string;
  httpVersion: string;
  headers: HarHeader[];
  queryString: Array<{ name: string; value: string }>;
  postData?: HarPostData;
}

export interface HarResponse {
  status: number;
  statusText: string;
  headers: HarHeader[];
  content: HarContent;
}

export interface HarEntry {
  startedDateTime: string;
  time: number;
  request: HarRequest;
  response: HarResponse;
  _resourceType?: string;
}

export interface HarLog {
  version: string;
  creator: { name: string; version: string };
  entries: HarEntry[];
}

export interface HarFile {
  log: HarLog;
}

// Wrapper for UI state (selection, grouping)
export interface HarEntryWrapper extends HarEntry {
  _index: number;
  _id: string;
  _selected: boolean;
  
  // Grouping & Source Info
  _harId: string;   // UUID of the specific HAR file
  _harName: string; // Filename
  _groupKey?: string; // For visual grouping (deprecated in favor of dynamic grouping in viewer)
}

// Extracted Data Structure
export interface ExtractedEntity {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
}

export interface KnowledgeLink {
  source: string; // Entity ID
  target: string; // Entity ID
  label: string;
}

export interface KnowledgeGraphData {
  nodes: ExtractedEntity[];
  links: KnowledgeLink[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: any;
  result?: any;
  status: 'pending' | 'success' | 'error';
  timestamp: number;
}

export interface ChatMessage {
  id?: string; // Optional for backward compatibility, but recommended
  role: 'user' | 'model' | 'system';
  text: string;
  toolCalls?: ToolCall[];
}

// --- Knowledge DB / ETL Pipeline Types ---

export enum ProcessingStatus {
  Unprocessed = 'unprocessed',
  SpFilterer = 'sp_filterer',
  Filtered = 'filtered',
  SpConverter = 'sp_converter',
  Converted = 'converted',
  SpConvert = 'sp_convert',
  FinalResponse = 'final_response'
}

export interface ScrapingEntry {
  id: string; // Unique UUID
  source_type_key: string; // e.g., 'POST:/api/v1/data'
  url: string;
  request: HarRequest;
  response: HarResponse | Record<string, any>; // Can be HAR response or JSON from proxy
  filterer_json: Record<string, any>; // Schema/Filter definition
  converter_code: string; // JS/Ruby code string
  final_clean_response: Record<string, any>;
  processing_status: ProcessingStatus;
  is_deleted?: boolean; // Soft delete flag
  workspace_id?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// --- Browser / Session Types ---
export interface BrowserSession {
  id: string;
  name: string;
  createdAt: string;
}

// Project Management Types
export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  requestCount: number;
  entityCount: number;
  size: number; // Approximate size in bytes
}

export interface ProjectData extends ProjectMetadata {
  harEntries: HarEntryWrapper[];
  knowledgeData: KnowledgeGraphData;
  chatHistory: ChatMessage[];
  scrapingEntries: ScrapingEntry[]; 
  browserSessions: BrowserSession[]; 
  backendUrl?: string;
  neo4jConfig?: Neo4jConfig;
}

export interface Neo4jConfig {
  uri: string;
  user: string;
  password?: string; // Optional if no auth
  browserUrl?: string; // For admin redirection
}

export interface ProjectBackup {
  version: string;
  timestamp: string;
  name?: string;
  harEntries: HarEntryWrapper[];
  knowledgeData: KnowledgeGraphData;
  chatHistory: ChatMessage[];
  scrapingEntries?: ScrapingEntry[];
  browserSessions?: BrowserSession[];
  neo4jConfig?: Neo4jConfig;
  backendUrl?: string;
}

// UI State Types
export enum ViewMode {
  PROJECTS = 'PROJECTS',
  UPLOAD = 'UPLOAD', // Kept for adding files to active project
  EXPLORE = 'EXPLORE',
  GRAPH = 'GRAPH',
  KNOWLEDGE_DB = 'KNOWLEDGE_DB',
  BROWSER = 'BROWSER', // New View
  TEST_TOOLS = 'TEST_TOOLS',
  SETTINGS = 'SETTINGS'
}

export interface ProjectState {
  // Global
  projects: ProjectMetadata[];
  activeProjectId: string | null;
  activeProject: ProjectData | null;
  
  // UI
  viewMode: ViewMode;
  isLoading: boolean;
  error: string | null;

  // Actions
  init: () => Promise<void>;
  createProject: (name: string, initialHarFile?: File) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  closeProject: () => void;
  deleteProject: (id: string) => Promise<void>;
  importProjectFromFile: (file: File) => Promise<void>;
  createProjectFromBackup: (backup: ProjectBackup) => Promise<void>;
  renameProject: (id: string, newName: string) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  
  // Active Project Actions
  addHarFile: (file: File) => Promise<void>;
  setHarEntries: (entries: HarEntryWrapper[]) => void;
  setKnowledgeData: (data: KnowledgeGraphData | ((prev: KnowledgeGraphData) => KnowledgeGraphData)) => void;
  setChatMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  importProjectData: (backup: ProjectBackup) => Promise<void>;
  
  // Knowledge DB Actions
  syncHarToDb: (entries: HarEntryWrapper[]) => void;
  updateScrapingEntry: (id: string, updates: Partial<ScrapingEntry>) => void;
  deleteScrapingEntry: (id: string) => void;
  
  // Settings
  setBackendUrl: (url: string) => void;
  setNeo4jConfig: (config: Neo4jConfig) => void;

  // Browser Actions
  createBrowserSession: (name: string) => void;
  deleteBrowserSession: (id: string) => void;
}
