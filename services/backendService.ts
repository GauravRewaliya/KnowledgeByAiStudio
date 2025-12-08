
/**
 * Service to communicate with the local backend proxy.
 */

export const executeProxyRequest = async (backendUrl: string, requestData: any, sessionId?: string): Promise<any> => {
    if (!backendUrl) {
        throw new Error("Backend URL is not configured. Please go to Settings.");
    }

    try {
        // Remove trailing slash
        const baseUrl = backendUrl.replace(/\/$/, "");
        
        // Construct the proxy URL with the target param as required by the Ruby controller
        // Expected route: /proxy?target=URL
        const proxyUrl = new URL(`${baseUrl}/proxy`);
        proxyUrl.searchParams.append('target', requestData.url);

        const fetchOptions: RequestInit = {
            method: requestData.method,
            headers: requestData.headers || {},
        };

        // Add body if not GET/HEAD
        if (requestData.method !== 'GET' && requestData.method !== 'HEAD' && requestData.body) {
            fetchOptions.body = requestData.body;
        }

        // Add sessionId to custom header if needed, or if the backend logic requires it in a specific way.
        // The provided Ruby code doesn't explicitly look for 'sessionId', but we can pass it in headers if needed.
        if (sessionId) {
            fetchOptions.headers = {
                ...fetchOptions.headers,
                'X-Session-ID': sessionId
            };
        }

        const response = await fetch(proxyUrl.toString(), fetchOptions);

        // The Ruby controller returns the target's body directly as JSON.
        // It sets the status code to the target's status code.
        // It does NOT return a wrapped object { content, headers, status }.
        // We must normalize this for our frontend components.
        
        const status = response.status;
        let content = '';
        let contentType = response.headers.get('content-type') || '';

        // Try to get text first
        const textBody = await response.text();
        content = textBody;

        // Try to parse as JSON if content-type suggests
        // But for our generic 'content' field, we usually keep it as string unless specific usage
        
        return {
            status,
            content,
            headers: {}, // Proxy doesn't return target headers in the response body, so we lose them here.
            harEntry: null // Cannot construct full HAR without request/response details that might be missing
        };

    } catch (e: any) {
        throw new Error(`Proxy Request Failed: ${e.message}`);
    }
};

/**
 * Checks if the backend is reachable.
 */
export const checkBackendHealth = async (backendUrl: string): Promise<boolean> => {
    if (!backendUrl) return false;
    try {
        const baseUrl = backendUrl.replace(/\/$/, "");
        // Assuming a generic health endpoint or root check
        // If the Ruby app doesn't have /health, we can try a harmless proxy call or just root
        const response = await fetch(`${baseUrl}/up`, { method: 'GET' }); // Rails 7+ default health check
        return response.ok;
    } catch {
        // Fallback: Try root
        try {
             const baseUrl = backendUrl.replace(/\/$/, "");
             await fetch(baseUrl, { method: 'GET' });
             return true; 
        } catch {
            return false;
        }
    }
};
