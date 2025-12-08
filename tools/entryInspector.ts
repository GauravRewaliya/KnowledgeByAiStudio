import { ToolDefinition, ToolFunction } from "../types/ai";
import { Type } from "@google/genai";
import { HarEntryWrapper } from "../types";
import { summarizeJsonStructure } from "../services/harUtils";

export const inspectEntrySchemaToolDefinition: ToolDefinition = {
  name: "inspect_entry_schema",
  description: "Get the detailed JSON SCHEMA/Structure of multiple HAR entries. Use this to understand the data shape before extracting. Arrays in the output are truncated to show the first item's schema.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      indices: { 
        type: Type.ARRAY, 
        items: { type: Type.NUMBER },
        description: "Array of _index values to inspect.",
        optional: false,
        dataSource: 'harEntryIndices'
      }
    },
    required: ["indices"]
  }
};

export const inspectEntrySchemaImpl: ToolFunction<{ indices: number[] }, any[]> = (harEntries, args) => {
    const indices = args.indices || [];
    const results = [];

    for (const idx of indices) {
        const entry = harEntries.find(e => e._index === idx);
        if (!entry) {
            results.push({ index: idx, error: "Entry not found" });
            continue;
        }

        let bodyData: any = null;
        try {
            if (entry.response.content.text) {
                const parsed = JSON.parse(entry.response.content.text);
                bodyData = summarizeJsonStructure(parsed);
            }
        } catch {
            bodyData = "Could not parse JSON body or body is empty/text.";
        }

        results.push({
            index: idx,
            url: entry.request.url,
            method: entry.request.method,
            status: entry.response.status,
            requestBodyStructure: entry.request.postData?.text ? summarizeJsonStructure(safeJsonParse(entry.request.postData.text)) : undefined,
            responseBodyStructure: bodyData
        });
    }

    return results;
};

const safeJsonParse = (text: string) => {
    try { return JSON.parse(text); } catch { return text; }
};