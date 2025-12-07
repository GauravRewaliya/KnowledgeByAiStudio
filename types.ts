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
  _groupKey?: string;
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

// UI State Types
export enum ViewMode {
  UPLOAD = 'UPLOAD',
  EXPLORE = 'EXPLORE',
  GRAPH = 'GRAPH',
  TEST_TOOLS = 'TEST_TOOLS', // New view mode for testing AI tools
}
