import { ToolDefinition, ToolFunction } from "../types/ai";
import { Type } from "@google/genai";
import { ScrapingEntry, ProcessingStatus, HarRequest } from "../types";
import { executeProxyRequest } from "../services/backendService";
import { useProjectStore } from "../store/projectStore";

// --- Tool: Find Similar Parser ---

export const findSimilarParserToolDefinition: ToolDefinition = {
  name: "find_similar_parser",
  description: "Search the Knowledge DB for existing scraping entries that share the same 'source_type_key' (Method + URL Path). Use this to reuse 'filterer_json' or 'converter_code' from previous work.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: { 
        type: Type.STRING, 
        description: "The full URL of the request to match.",
        optional: false
      },
      method: { 
        type: Type.STRING, 
        description: "HTTP Method (GET, POST, etc.)",
        optional: false
      }
    },
    required: ["url", "method"]
  }
};

export const findSimilarParserImpl: ToolFunction<{ url: string, method: string }, any> = (harEntries, args) => {
    // Access the store directly to get scraping entries
    const store = useProjectStore.getState();
    const scrapingEntries = store.activeProject?.scrapingEntries || [];

    try {
        const urlObj = new URL(args.url);
        const targetKey = `${args.method}:${urlObj.pathname}`;
        
        const matches = scrapingEntries.filter((e: ScrapingEntry) => e.source_type_key === targetKey && e.processing_status === ProcessingStatus.FinalResponse);
        
        if (matches.length === 0) return { found: false, message: "No similar processed entries found." };
        
        const bestMatch = matches[0];
        return {
            found: true,
            source_type_key: bestMatch.source_type_key,
            filterer_json: bestMatch.filterer_json,
            converter_code: bestMatch.converter_code
        };

    } catch (e: any) {
        return { error: e.message };
    }
};

// --- Tool: Update Scraping Entry ---

export const updateScrapingEntryToolDefinition: ToolDefinition = {
  name: "update_scraping_entry",
  description: "Update a Scraping Entry in the Knowledge DB. Use this to save the 'filterer_json' or 'converter_code' you generated.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: "The UUID of the scraping entry." },
      filterer_json: { type: Type.OBJECT, description: "Schema definition used for filtering.", optional: true },
      converter_code: { type: Type.STRING, description: "JS code to convert the response.", optional: true },
      status: { type: Type.STRING, description: "New status (e.g. 'filtered', 'converted').", optional: true }
    },
    required: ["id"]
  }
};

export const updateScrapingEntryImpl: ToolFunction<{ id: string, filterer_json?: any, converter_code?: string, status?: string }, any> = (harEntries, args) => {
    const store = useProjectStore.getState();
    
    store.updateScrapingEntry(args.id, {
        ...(args.filterer_json && { filterer_json: args.filterer_json }),
        ...(args.converter_code && { converter_code: args.converter_code }),
        ...(args.status && { processing_status: args.status as ProcessingStatus })
    });

    return { success: true, message: `Entry ${args.id} updated.` };
};

// --- Tool: Execute Proxy Request ---

export const executeProxyRequestToolDefinition: ToolDefinition = {
  name: "execute_proxy_request",
  description: "Execute a request via the local backend proxy. Useful to get fresh data or bypass CORS.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: { type: Type.STRING, description: "Target URL" },
      method: { type: Type.STRING, description: "HTTP Method" },
      headers: { type: Type.OBJECT, description: "Headers object", optional: true },
      body: { type: Type.STRING, description: "Body string", optional: true }
    },
    required: ["url", "method"]
  }
};

export const executeProxyRequestImpl: ToolFunction<{ url: string, method: string, headers?: any, body?: string }, any> = async (harEntries, args) => {
    const store = useProjectStore.getState();
    const backendUrl = store.activeProject?.backendUrl;

    if (!backendUrl) return { error: "Backend URL is not configured in this project settings." };

    try {
        const result = await executeProxyRequest(backendUrl, {
            url: args.url,
            method: args.method,
            headers: args.headers,
            body: args.body
        });
        return { success: true, data: result };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};