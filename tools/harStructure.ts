import { ToolDefinition, ToolFunction } from "../types/ai";
import { Type } from "@google/genai";
import { HarEntryWrapper } from "../types";

// Define the shape of the summarized HAR entry
interface HarEntrySummary {
  index: number;
  id: string;
  method: string;
  url: string;
  status: number;
  size: number;
  mimeType: string;
  isGraphQL: boolean;
}

export const getHarStructureToolDefinition: ToolDefinition = {
  name: "get_har_structure",
  description: "Query and filter requests in the HAR file. Returns a summary list (index, method, url, status). Use 'indices' to fetch specific items, or filters like 'url_contains' to search.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      indices: {
        type: Type.ARRAY,
        items: { type: Type.NUMBER },
        description: "Specific entry indices to retrieve.",
        optional: true
      },
      method: { 
        type: Type.STRING, 
        description: "Filter by HTTP method (e.g., 'POST', 'GET'). Case insensitive.",
        optional: true
      },
      url_contains: {
        type: Type.STRING,
        description: "Filter URLs containing this string.",
        optional: true
      },
      status_code: {
        type: Type.NUMBER,
        description: "Filter by exact status code (e.g., 200, 404).",
        optional: true
      },
      limit: {
        type: Type.NUMBER,
        description: "Max number of results to return. Default 20.",
        optional: true,
        default: 20
      },
      offset: {
        type: Type.NUMBER,
        description: "Pagination offset. Default 0.",
        optional: true,
        default: 0
      },
      only_selected: {
        type: Type.BOOLEAN,
        description: "If true, only search within user-selected entries in the UI.",
        optional: true,
        default: false
      }
    },
    required: []
  }
};

export const getHarStructureImpl: ToolFunction<{ 
    indices?: number[];
    method?: string; 
    url_contains?: string; 
    status_code?: number; 
    limit?: number; 
    offset?: number;
    only_selected?: boolean;
}, HarEntrySummary[]> = (harEntries, args) => {
    
    let candidates = args.only_selected 
        ? harEntries.filter(e => e._selected) 
        : harEntries;

    // Direct index fetching overrides other filters if present, or acts as base
    if (args.indices && args.indices.length > 0) {
        const indexSet = new Set(args.indices);
        candidates = candidates.filter(e => indexSet.has(e._index));
    } else {
        // Apply text filters only if no specific indices requested (or to filter further)
        if (args.method) {
            const m = args.method.toUpperCase();
            candidates = candidates.filter(e => e.request.method.toUpperCase() === m);
        }

        if (args.url_contains) {
            const search = args.url_contains.toLowerCase();
            candidates = candidates.filter(e => e.request.url.toLowerCase().includes(search));
        }

        if (args.status_code !== undefined) {
            candidates = candidates.filter(e => e.response.status === args.status_code);
        }
    }

    // Pagination
    const limit = args.limit || 20;
    const offset = args.offset || 0;
    const paged = candidates.slice(offset, offset + limit);

    return paged.map(e => ({
        index: e._index,
        id: e._id,
        method: e.request.method,
        url: e.request.url,
        status: e.response.status,
        size: e.response.content.size,
        mimeType: e.response.content.mimeType,
        isGraphQL: e.request.url.includes('graphql') || e.request.postData?.text?.includes('query')
    }));
};