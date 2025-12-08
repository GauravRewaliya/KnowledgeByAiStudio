
/**
 * Service to communicate with the local backend proxy.
 */

export const executeProxyRequest = async (backendUrl: string, requestData: any, sessionId?: string): Promise<any> => {
    if (!backendUrl) {
        throw new Error("Backend URL is not configured. Please go to Settings.");
    }

    // Ensure clean URL
    const baseUrl = backendUrl.replace(/\/$/, "");

    try {
        // Construct the proxy URL with the target param as required by the Ruby controller
        // Expected route: /proxy?target=URL
        const proxyUrl = new URL(`${baseUrl}/proxy`);
        proxyUrl.searchParams.append('target', requestData.url);

        const fetchOptions: RequestInit = {
            method: requestData.method,
            headers: requestData.headers
        };

        // Add body if not GET/HEAD
        if (requestData.method !== 'GET' && requestData.method !== 'HEAD' && requestData.body) {
            fetchOptions.body = requestData.body;
        }

        // NOTE: 'X-Session-ID' injection is removed to prevent unnecessary CORS Preflight (OPTIONS) requests.
        // If the backend is strict about CORS, adding custom headers forces a preflight which might fail 
        // if the proxy controller doesn't handle OPTIONS explicitly.
        
        const response = await fetch(proxyUrl.toString(), fetchOptions);

        // The Ruby controller returns the target's body directly as JSON.
        // It sets the status code to the target's status code.
        const status = response.status;
        let content = '';

        // Try to get text first
        const textBody = await response.text();
        content = textBody;

        return {
            status,
            content,
            headers: {}, // Proxy doesn't return target headers in the response body, so we lose them here.
            harEntry: null
        };

    } catch (e: any) {
        // Handle network errors explicitly
        if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
             throw new Error(`Network Error: Could not reach ${baseUrl}.\n\nCommon Causes:\n1. Backend is not running.\n2. You are using DevTunnels and haven't accepted the warning.\n3. CORS is blocking the request (Preflight failed).`);
        }
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
        // Try a simple fetch to root or a known endpoint
        // We DO NOT use 'no-cors' here because we need to send the headers to bypass the warning page.
        // If we use 'no-cors', the headers are stripped, and we hit the warning page (opaque response), 
        // which might look like success but isn't valid for API usage.
        await fetch(baseUrl, { 
            method: 'GET'
        }); 
        return true;
    } catch (e) {
        console.warn("Backend health check failed:", e);
        return false;
    }
};
