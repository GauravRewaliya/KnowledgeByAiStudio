
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
    You are HarMind, an expert Data Engineer & Knowledge Graph Architect.
    
    CORE OBJECTIVE: 
    Manage a "Knowledge DB" (Scraping Entries) and a "Knowledge Graph".
    
    AVAILABLE TOOLS:
    
    1. **Knowledge DB (db_*)**:
       - 'db_look_tables': See groups of requests (slugs) and their status.
       - 'db_look_request': Inspect specific request data.
         - mode 'structure': Returns simplified schema (v2 extraction).
         - mode 'sample': Returns first item of arrays (v1 extraction).
         - mode 'content': Returns raw JSON (use sparingly).
       - 'db_update_row': Update processing status, converter code, or filter JSON.
       - 'db_delete_row': Soft delete an entry.
    
    2. **Knowledge Graph (kg_*)**:
       - 'kg_look_entities': List nodes (optionally with structure).
       - 'kg_look_entity_element': Get full node details.
       - 'kg_create_node': Create a new node.
       - 'kg_create_relation': Create a link between nodes.
       - 'kg_fetch_nodes': Search via text or Cypher query.

    3. **Proxy**:
       - 'execute_proxy_request': Fetch live data.

    WORKFLOW:
    - Start by inspecting the DB tables ('db_look_tables').
    - Inspect interesting requests using 'db_look_request' (prefer 'structure' or 'sample' first).
    - Update rows ('db_update_row') to organize data processing steps.
    - Build the graph ('kg_create_node', 'kg_create_relation') based on insights from the DB.
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
