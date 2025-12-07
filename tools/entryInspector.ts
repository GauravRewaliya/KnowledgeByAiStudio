import { ToolDefinition, ToolFunction } from "../types/ai";
import { Type } from "@google/genai";
import { HarEntryWrapper } from "../types";
import { summarizeJsonStructure } from "../services/harUtils";

export const inspectEntrySchemaToolDefinition: ToolDefinition = {
  name: "inspect_entry_schema",
  description: "Get the detailed JSON SCHEMA/Structure of a specific HAR entry. Use this to understand the data shape before extracting. Arrays are truncated to show the first item's schema.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      index: { 
        type: Type.NUMBER, 
        description: "The _index of the entry to inspect",
        optional: false,
        dataSource: 'harEntryIndices' // Hint for UI to provide dropdown of valid indices
      }
    },
    required: ["index"]
  }
};

export const inspectEntrySchemaImpl: ToolFunction<{ index: number }, any> = (harEntries, args) => {
    const entry = harEntries.find(e => e._index === args.index);
    if (!entry) return { error: "Entry not found for index: " + args.index };

    let bodyData: any = null;
    try {
        if (entry.response.content.text) {
            const parsed = JSON.parse(entry.response.content.text);
            bodyData = summarizeJsonStructure(parsed);
        }
    } catch {
        bodyData = "Could not parse JSON body or body is empty.";
    }

    return {
        url: entry.request.url,
        method: entry.request.method,
        status: entry.response.status,
        responseHeaders: entry.response.headers.map(h => ({name: h.name, value: h.value})).slice(0, 10), // Limit headers
        requestBody: entry.request.postData?.text ? summarizeJsonStructure(JSON.parse(entry.request.postData.text)) : undefined,
        responseBodyStructure: bodyData
    };
};
