
/**
 * Service to communicate with the local backend proxy.
 * This allows the browser to trigger cURL requests via a backend to avoid CORS and get fresh data.
 */

export const executeProxyRequest = async (backendUrl: string, requestData: any, sessionId?: string): Promise<any> => {
    if (!backendUrl) {
        throw new Error("Backend URL is not configured. Please go to Settings.");
    }

    try {
        // Remove trailing slash
        const baseUrl = backendUrl.replace(/\/$/, "");
        
        // Prepare payload, including sessionId if present
        const payload = {
            ...requestData,
            sessionId: sessionId || undefined
        };

        const response = await fetch(`${baseUrl}/proxy/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Backend Error (${response.status}): ${text}`);
        }

        // Expected response format:
        // { 
        //   content: string (HTML/JSON), 
        //   headers: object, 
        //   status: number,
        //   harEntry?: HarEntry (Optional, if backend captures it)
        // }
        return await response.json();
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
        const response = await fetch(`${baseUrl}/health`, { method: 'GET' });
        return response.ok;
    } catch {
        return false;
    }
};
