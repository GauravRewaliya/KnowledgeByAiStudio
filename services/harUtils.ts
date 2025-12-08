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
        if (obj.length > 0) {
            return [summarizeJsonStructure(obj[0], depth + 1), `... (${obj.length - 1} more items)`];
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

/**
 * Truncates text content intelligently.
 */
export const truncateContent = (text: string | undefined, maxLength: number): string => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + `... [content trimmed, total: ${text.length} chars. Call again with higher limit if needed]`;
};

/**
 * Generates a cURL command from a HAR request object.
 */
export const generateCurlCommand = (request: any): string => {
    const parts: string[] = [];
    
    // Basic command and URL
    // Escape single quotes in URL just in case
    const url = request.url.replace(/'/g, "'\\''");
    parts.push(`curl '${url}'`);
    
    // Method
    parts.push(`-X '${request.method}'`);
    
    // Headers
    if (request.headers) {
        request.headers.forEach((header: any) => {
            // Skip pseudo-headers
            if (header.name.startsWith(':')) return;
            
            // Skip content-length as it's auto-calculated by curl if body exists.
            // Sending a mismatching content-length can cause the server to hang or error.
            if (header.name.toLowerCase() === 'content-length') return;

            // Escape single quotes in header values
            const value = header.value.replace(/'/g, "'\\''");
            parts.push(`-H '${header.name}: ${value}'`);
        });
    }

    // Body
    if (request.postData && request.postData.text) {
        // Escape single quotes in the body
        const body = request.postData.text.replace(/'/g, "'\\''");
        parts.push(`--data-raw '${body}'`);
    }

    // Compression handling to avoid binary output warning
    // Browser requests usually include Accept-Encoding: gzip. 
    // curl needs --compressed to decode it, otherwise it prints binary and warns the user.
    parts.push('--compressed');
    
    // Join with line continuation and indentation
    return parts.join(' \\\n  ');
};