
import { ToolDefinition, ToolFunction } from "../types/ai";
import { Type } from "@google/genai";
import { HarEntryWrapper } from "../types";

export const runExtractionCodeToolDefinition: ToolDefinition = {
  name: "run_extraction_code",
  description: "Execute JavaScript code to extract data from the HAR entries. The code has access to an `entries` array. You can either `return` an array of objects or `push` objects to the `results` array. This tool triggers an event to update the Knowledge Graph.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      code: { 
        type: Type.STRING, 
        description: "JavaScript code. Example: return entries.filter(e => e.request.url.includes('api')).map(e => ({ url: e.request.url, data: JSON.parse(e.response.content.text) }));",
        optional: false
      }
    },
    required: ["code"]
  }
};

export const runExtractionCodeImpl: ToolFunction<{ code: string }, any> = (harEntries, args) => {
    const activeEntries = harEntries.some(e => e._selected) ? harEntries.filter(e => e._selected) : harEntries;
    const logs: string[] = [];
    
    try {
        // Improved wrapper that handles both 'results.push' and 'return [...]' patterns
        const safeCode = `
            const results = [];
            const log = (...msg) => logs.push(JSON.stringify(msg.length === 1 ? msg[0] : msg));

            // Execute user code in an IIFE to capture return values
            const userResult = (() => {
                ${args.code}
            })();

            // If user code returned an array, use it. Otherwise fall back to 'results' array.
            if (Array.isArray(userResult)) {
                return userResult;
            }
            return results;
        `;

        // eslint-disable-next-line no-new-func
        const fn = new Function('entries', 'logs', safeCode);
        const extracted = fn(activeEntries, logs);
        
        return { success: true, count: extracted.length, data: extracted, logs };

    } catch (e: any) {
        return { success: false, error: e.message, logs };
    }
};
