import { HarEntryWrapper, HarEntry } from "../types";

/**
 * Summarizes the HAR file structure for the AI.
 * It truncates detailed lists to avoid token limits.
 */
export const getHarStructureSummary = (entries: HarEntryWrapper[]) => {
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
        // Return first item as sample + length indicator, if possible
        // The previous behavior `[`<Array of ${obj.length} items. Sample:>`, summarizeJsonStructure(obj[0], depth + 1)];` was a bit too verbose for Gemini.
        // Let's simplify to just the first item's schema for brevity, and a string for empty/short arrays.
        if (obj.length > 0) {
            return [summarizeJsonStructure(obj[0], depth + 1)];
        }
        return []; // Empty array
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
