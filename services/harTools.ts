import { HarEntryWrapper, HarEntry } from "../types";

/**
 * Summarizes the HAR file structure for the AI.
 * It truncates detailed lists to avoid token limits.
 */
export const getHarStructure = (entries: HarEntryWrapper[]) => {
    // Only consider selected entries if any are selected, else all
    const activeEntries = entries.some(e => e._selected) ? entries.filter(e => e._selected) : entries;

    return activeEntries.map(e => ({
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

/**
 * Summarizes a JSON object by truncating arrays to length 1 and simplifying strings.
 * This is used to show the "Schema" to the AI without sending 5MB of data.
 */
export const summarizeJsonStructure = (obj: any, depth = 0): any => {
    if (depth > 5) return "... (max depth)";
    
    if (Array.isArray(obj)) {
        if (obj.length === 0) return [];
        // Return first item as sample + length indicator
        return [`<Array of ${obj.length} items. Sample:>`, summarizeJsonStructure(obj[0], depth + 1)];
    }
    
    if (obj !== null && typeof obj === 'object') {
        const newObj: any = {};
        for (const key in obj) {
            newObj[key] = summarizeJsonStructure(obj[key], depth + 1);
        }
        return newObj;
    }
    
    if (typeof obj === 'string' && obj.length > 100) {
        return obj.substring(0, 50) + "... (truncated)";
    }
    
    return obj;
};

export const getEntryDetails = (entries: HarEntryWrapper[], index: number) => {
    const entry = entries.find(e => e._index === index);
    if (!entry) return "Entry not found";

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
        headers: entry.response.headers.map(h => h.name + ": " + h.value).slice(0, 10), // Limit headers
        bodyStructure: bodyData
    };
};

export const runExtractionCode = (entries: HarEntryWrapper[], code: string) => {
    const activeEntries = entries.some(e => e._selected) ? entries.filter(e => e._selected) : entries;
    const results: any[] = [];
    const logs: string[] = [];
    
    // Sandbox-ish execution
    // We create a function that takes 'entries' and returns extracted data
    try {
        // Wrap user code to make it safe-ish and usable
        // The AI is expected to write a function body that iterates `entries` or filters them
        // We provide `entries` variable.
        
        const safeCode = `
            const results = [];
            
            // Helper to log
            const log = (msg) => logs.push(JSON.stringify(msg));

            ${code}
            
            return results;
        `;

        // eslint-disable-next-line no-new-func
        const fn = new Function('entries', 'logs', safeCode);
        const extracted = fn(activeEntries, logs);
        return { success: true, data: extracted, logs };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
};
