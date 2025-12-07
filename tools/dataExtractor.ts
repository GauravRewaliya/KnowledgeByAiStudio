import { ToolDefinition, ToolFunction } from "../types/ai";
import { Type } from "@google/genai";
import { HarEntryWrapper } from "../types";

export const runExtractionCodeToolDefinition: ToolDefinition = {
  name: "run_extraction_code",
  description: "Execute JavaScript code to extract data from the HAR entries. The code has access to an `entries` array (containing only selected entries if any are selected, else all). Push objects to `results` array. This tool will trigger an event to update the Knowledge Graph.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      code: { 
        type: Type.STRING, 
        description: "JavaScript code. Example: entries.forEach(e => { if(e.request.url.includes('api')) results.push({ url: e.request.url, data: JSON.parse(e.response.content.text) }) })",
        optional: false
      }
    },
    required: ["code"]
  }
};

export const runExtractionCodeImpl: ToolFunction<{ code: string }, any> = (harEntries, args) => {
    const activeEntries = harEntries.some(e => e._selected) ? harEntries.filter(e => e._selected) : harEntries;
    const results: any[] = [];
    const logs: string[] = [];
    
    try {
        const safeCode = `
            const results = [];
            const log = (...msg) => logs.push(JSON.stringify(msg));

            ${args.code}
            
            return results;
        `;

        // eslint-disable-next-line no-new-func
        const fn = new Function('entries', 'logs', safeCode);
        const extracted = fn(activeEntries, logs);
        
        return { success: true, data: extracted, logs };

    } catch (e: any) {
        return { success: false, error: e.message, logs };
    }
};
