import { ToolDefinition, ToolFunction } from "../types/ai";
import { Type } from "@google/genai";
import { truncateContent } from "../services/harUtils";

export const getResponseContentToolDefinition: ToolDefinition = {
  name: "get_response_content",
  description: "Get the actual text content of response bodies for specific requests. Returns a map of index -> content. Content is automatically truncated if it exceeds max_length.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      indices: {
        type: Type.ARRAY,
        items: { type: Type.NUMBER },
        description: "Array of entry indices to fetch.",
        optional: false,
        dataSource: 'harEntryIndices'
      },
      max_length: {
        type: Type.NUMBER,
        description: "Maximum characters to return per entry. Default 500.",
        optional: true,
        default: 500
      }
    },
    required: ["indices"]
  }
};

export const getResponseContentImpl: ToolFunction<{ indices: number[], max_length?: number }, any> = (harEntries, args) => {
    const indices = args.indices || [];
    const maxLength = args.max_length || 500;
    const results: Record<number, any> = {};

    for (const idx of indices) {
        const entry = harEntries.find(e => e._index === idx);
        if (!entry) {
            results[idx] = { error: "Entry not found" };
            continue;
        }
        
        const content = entry.response.content.text || "";
        results[idx] = truncateContent(content, maxLength);
    }

    return results;
};