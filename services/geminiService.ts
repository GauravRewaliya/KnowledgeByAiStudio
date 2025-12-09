
import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Type } from "@google/genai";
import { KnowledgeGraphData, HarEntryWrapper, ToolCall } from "../types";
import { allToolDefinitions, toolImplementations } from "../tools"; // Import all tools
import { ToolDefinition } from "../types/ai"; // Import ToolDefinition type

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please set process.env.API_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

// Convert our ToolDefinition to GoogleGenAI's FunctionDeclaration format
const geminiTools: FunctionDeclaration[] = allToolDefinitions.map(tool => ({
  name: tool.name,
  description: tool.description,
  parameters: {
    type: Type.OBJECT,
    properties: Object.fromEntries(
      Object.entries(tool.parameters.properties).map(([key, prop]) => [
        key,
        {
          type: prop.type,
          description: prop.description,
          items: prop.items ? { type: prop.items.type } : undefined
        }
      ])
    ),
    required: tool.parameters.required
  }
}));

export const runHarAgent = async (
  history: { role: string; text: string }[],
  currentMessage: string,
  harData: HarEntryWrapper[],
  callbacks: {
    onDataExtracted?: (data: any[]) => void;
    onToolUpdate?: (toolCall: ToolCall) => void;
  }
): Promise<string> => {
  const ai = getAiClient();
  const model = "gemini-2.5-flash";
  const { onDataExtracted, onToolUpdate } = callbacks;

  const systemInstruction = `
    You are HarMind, an expert Data Engineer & Network Analyst AI.
    
    CORE OBJECTIVE: 
    Manage a "Knowledge DB" (Scraping Entries) and a "Knowledge Graph".
    
    OPERATIONAL MODE - "KNOWLEDGE ENGINEER":
    1. **DB Management**: 
       - Use 'db_look_tables' to see grouped requests (slugs) and their status.
       - Use 'db_look_request' with mode='structure' or 'sample' to inspect JSON data safely.
       - Use 'db_update_row' to define filter/converter logic or advance processing steps.
       - Use 'db_delete_row' to remove irrelevant data.
    
    2. **Graph Management**:
       - Use 'kg_look_entities' to see what's in the graph.
       - Use 'kg_create_node' and 'kg_create_relation' to build the graph from DB insights.
       - Use 'kg_fetch_nodes' to query data (supports basic text or Cypher).

    3. **Proxy**:
       - Use 'execute_proxy_request' to fetch live data if needed.

    STYLE GUIDE:
    - Be conversational but professional.
    - When analyzing JSON, prefer 'structure' or 'sample' modes first to save tokens.
    - Only use 'content' mode (full raw JSON) if specifically asked or strictly necessary for small payloads.
  `;

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: geminiTools }],
    },
    history: history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }))
  });

  // Initial message
  let response = await chat.sendMessage({ message: currentMessage });

  // Loop for function calls (max 5 turns to prevent infinite loops)
  let turns = 0;
  while (response.functionCalls && response.functionCalls.length > 0 && turns < 5) {
    turns++;
    const functionCalls = response.functionCalls;
    const functionResponses = [];

    for (const call of functionCalls) {
      const name = call.name;
      const args = call.args as any;
      const callId = call.id || `call_${Date.now()}_${Math.random()}`;
      
      let result: any = { error: "Unknown function" };

      // Notify UI: Tool Started
      if (onToolUpdate) {
        onToolUpdate({
            id: callId,
            name: name,
            args: args,
            status: 'pending',
            timestamp: Date.now()
        });
      }

      console.log(`[Agent] Calling tool: ${name}`, args);

      try {
        const toolFunc = toolImplementations[name];
        if (toolFunc) {
          result = await toolFunc(harData, args); // Await all, just in case
        } else {
          result = { error: `Tool '${name}' not implemented.` };
        }
      } catch (e: any) {
        result = { error: e.message };
      }

      // Notify UI: Tool Finished
      if (onToolUpdate) {
        onToolUpdate({
            id: callId,
            name: name,
            args: args, // Keep args
            result: result,
            status: result.error || (result.success === false) ? 'error' : 'success',
            timestamp: Date.now()
        });
      }

      functionResponses.push({
        functionResponse: {
          id: call.id,
          name: call.name,
          response: { result: result }
        }
      });
    }

    // Send tool output back to model
    response = await chat.sendMessage({ message: functionResponses });
  }

  return response.text || "I processed the actions but have no text response.";
};
