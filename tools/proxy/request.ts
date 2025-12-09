
import { ToolDefinition, ToolFunction } from "../../types/ai";
import { Type } from "@google/genai";
import { executeProxyRequest } from "../../services/backendService";
import { useProjectStore } from "../../store/projectStore";
import { parseCurlCommand } from "../../services/harUtils";

export const executeProxyRequestToolDefinition: ToolDefinition = {
  name: "execute_proxy_request",
  description: "Execute a request via the local backend proxy. Useful to get fresh data or bypass CORS. You can provide explicit details OR a raw curl command.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: { type: Type.STRING, description: "Target URL", optional: true },
      method: { type: Type.STRING, description: "HTTP Method", optional: true },
      headers: { type: Type.OBJECT, description: "Headers object", optional: true },
      body: { type: Type.STRING, description: "Body string", optional: true },
      curl_command: { type: Type.STRING, description: "Raw cURL command string. If provided, overrides other params.", optional: true }
    },
    required: []
  }
};

export const executeProxyRequestImpl: ToolFunction<{ url?: string, method?: string, headers?: any, body?: string, curl_command?: string }, any> = async (harEntries, args) => {
    const store = useProjectStore.getState();
    const backendUrl = store.activeProject?.backendUrl;

    if (!backendUrl) return { error: "Backend URL is not configured in this project settings." };

    let requestData = {
        url: args.url,
        method: args.method,
        headers: args.headers,
        body: args.body
    };

    // If cURL command provided, parse it to populate request data
    if (args.curl_command) {
        try {
            const parsed = parseCurlCommand(args.curl_command);
            requestData = {
                url: parsed.url,
                method: parsed.method,
                headers: parsed.headers,
                body: parsed.body
            };
        } catch (e: any) {
            return { success: false, error: `Failed to parse cURL command: ${e.message}` };
        }
    }

    if (!requestData.url || !requestData.method) {
        return { success: false, error: "Missing URL or Method. Provide explicitly or via valid cURL command." };
    }

    try {
        const result = await executeProxyRequest(backendUrl, {
            url: requestData.url,
            method: requestData.method,
            headers: requestData.headers,
            body: requestData.body
        });
        return { success: true, data: result };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};
