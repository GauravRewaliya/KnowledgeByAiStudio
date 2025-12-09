
import { HarEntryWrapper, HarEntry } from "../types";

/**
 * Summarizes the HAR file structure for the AI.
 */
export const getHarStructureSummary = (entries: HarEntryWrapper[]) => {
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
 * Logic to extract the first array element, recursively for Hash of Arrays.
 * Matches Ruby implementation: extract_first_array
 */
export const extractFirstArray = (jsonBody: any): any => {
    if (jsonBody === null || jsonBody === undefined) return jsonBody;

    if (typeof jsonBody === 'object' && !Array.isArray(jsonBody)) {
        // Hash / Object logic
        const result: any = {};
        for (const key in jsonBody) {
            const value = jsonBody[key];
            
            if (Array.isArray(value)) {
                 if (value.length === 0) {
                     result[key] = [];
                 } else {
                     const item = value[0];
                     const isPrimitive = ['string', 'number', 'boolean'].includes(typeof item) || item === null;
                     const isHash = typeof item === 'object' && item !== null && !Array.isArray(item);
                     
                     if (isPrimitive) {
                         result[key] = [item];
                     } else if (isHash) {
                         result[key] = [extractFirstArray(item)];
                     } else {
                         // Fallback for mixed or other types, mirroring "Invalid JSON structure" handling by taking first
                         result[key] = [item];
                     }
                 }
            } else if (typeof value === 'object' && value !== null) {
                result[key] = extractFirstArray(value);
            } else {
                result[key] = value;
            }
        }
        return result;
    } else if (Array.isArray(jsonBody)) {
        return jsonBody.length > 0 ? [extractFirstArray(jsonBody[0])] : [];
    }
    
    return jsonBody;
};

/**
 * Logic to extract object structure (v2).
 * Matches Ruby implementation: extract_first_object
 */
export const extractFirstObject = (jsonBody: any): any => {
    if (jsonBody === null) return null;
    
    const type = typeof jsonBody;
    if (type === 'string' || type === 'number' || type === 'boolean') {
        return jsonBody;
    }
    
    if (Array.isArray(jsonBody)) {
        return jsonBody.length > 0 ? [extractFirstObject(jsonBody[0])] : [];
    }
    
    if (type === 'object') {
        const result: any = {};
        for (const key in jsonBody) {
            result[key] = extractFirstObject(jsonBody[key]);
        }
        return result;
    }
    
    return jsonBody;
};

/**
 * Summarizes a JSON object using extractFirstObject.
 */
export const summarizeJsonStructure = (obj: any, depth = 0): any => {
    return extractFirstObject(obj);
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
    const url = request.url.replace(/'/g, "'\\''");
    parts.push(`curl '${url}'`);
    
    // Method
    parts.push(`-X '${request.method}'`);
    
    // Headers
    if (request.headers) {
        request.headers.forEach((header: any) => {
            if (header.name.startsWith(':')) return;
            if (header.name.toLowerCase() === 'content-length') return;
            const value = header.value.replace(/'/g, "'\\''");
            parts.push(`-H '${header.name}: ${value}'`);
        });
    }

    // Body
    if (request.postData && request.postData.text) {
        const body = request.postData.text.replace(/'/g, "'\\''");
        parts.push(`--data-raw '${body}'`);
    }

    parts.push('--compressed');
    return parts.join(' \\\n  ');
};

/**
 * Parses a basic cURL command string into method, url, headers, and body.
 */
export const parseCurlCommand = (curlStr: string): { url: string; method: string; headers: Record<string, string>; body?: string } => {
    const result = {
        url: '',
        method: 'GET',
        headers: {} as Record<string, string>,
        body: undefined as string | undefined
    };

    const cleanStr = curlStr.replace(/\\\n/g, ' ').replace(/\s+/g, ' ').trim();

    const urlMatch = cleanStr.match(/curl\s+['"]?([^'"]+)['"]?/);
    if (urlMatch) result.url = urlMatch[1];

    const methodMatch = cleanStr.match(/-X\s+['"]?([A-Z]+)['"]?/);
    if (methodMatch) result.method = methodMatch[1];

    const headerRegex = /-H\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = headerRegex.exec(cleanStr)) !== null) {
        const headerContent = match[1];
        const splitIdx = headerContent.indexOf(':');
        if (splitIdx > 0) {
            const key = headerContent.substring(0, splitIdx).trim();
            const val = headerContent.substring(splitIdx + 1).trim();
            result.headers[key] = val;
        }
    }

    const bodyMatch = cleanStr.match(/(--data-raw|--data|-d)\s+['"]((?:[^'"]|\\['"])+)['"]/);
    if (bodyMatch) {
        result.body = bodyMatch[2];
        if (result.method === 'GET') result.method = 'POST';
    }

    return result;
};
