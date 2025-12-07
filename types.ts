
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

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  text: string;
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
}

export interface ProjectBackup {
  version: string;
  timestamp: string;
  name?: string;
  harEntries: HarEntryWrapper[];
  knowledgeData: KnowledgeGraphData;
  chatHistory: ChatMessage[];
}

// UI State Types
export enum ViewMode {
  PROJECTS = 'PROJECTS',
  UPLOAD = 'UPLOAD', // Kept for adding files to active project
  EXPLORE = 'EXPLORE',
  GRAPH = 'GRAPH',
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
  renameProject: (id: string, newName: string) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  
  // Active Project Actions
  addHarFile: (file: File) => Promise<void>;
  setHarEntries: (entries: HarEntryWrapper[]) => void;
  setKnowledgeData: (data: KnowledgeGraphData | ((prev: KnowledgeGraphData) => KnowledgeGraphData)) => void;
  setChatMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  importProjectData: (backup: ProjectBackup) => Promise<void>;
}
