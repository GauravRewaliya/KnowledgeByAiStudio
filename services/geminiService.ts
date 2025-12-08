
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
    Analyze HAR files to build a structured Knowledge Database (ScrapingEntries). 
    Your goal is NOT just to read data, but to create the *logic* (parsers/converters) to extract it efficiently.
    
    OPERATIONAL MODE - "SMART SCRAPER":
    1. **Explore First**: Use 'get_har_structure' to filter requests (by method, url part, or index).
    2. **Inspect Structure**: Use 'inspect_entry_schema' to understand the JSON shape of relevant entries.
    3. **Peek Content**: Use 'get_response_content' with 'max_length' to see actual values if the schema is ambiguous.
       - Note: Content is returned as "Trimmed... [call more if want]". Do not request full content unless absolutely necessary.
    4. **Generate Logic**: 
       - Instead of outputting massive JSON data to the user, write JavaScript code.
       - Use 'update_scraping_entry' to save 'converter_code' that parses the response.
       - Use 'run_extraction_code' if the user asks for immediate extraction into the graph.
    
    TOOLS:
    - 'get_har_structure': Filter requests. Supports 'method', 'url_contains', 'indices'.
    - 'inspect_entry_schema': Get JSON schema for list of indices.
    - 'get_response_content': Get raw text (truncated).
    - 'find_similar_parser': Check if we already have logic for this URL pattern.
    - 'update_scraping_entry': Save your parser/filter logic to the DB.
    - 'run_extraction_code': Execute one-off extraction code.

    STYLE GUIDE:
    - Be conversational but professional.
    - Preserve tokens: Don't repeat large data blocks. Refer to IDs/Indices.
    - If a user asks "Get me the projects", don't list them all in chat. 
      Instead, say: "I've identified the 'projects' array in request #12. I'm writing a parser to extract them to the Knowledge Graph." then call the tools to do so.
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
          
          if (name === 'run_extraction_code' && result.success && onDataExtracted) {
             if (result.data && Array.isArray(result.data) && result.data.length > 0) {
                 onDataExtracted(result.data);
                 // We don't send the full data back to LLM to save tokens, just a sample/count
                 result = { 
                     success: true, 
                     count: result.data.length, 
                     sample: result.data.slice(0, 2), 
                     note: "Data successfully pushed to graph." 
                 };
             } else {
                 result = { success: true, count: 0, note: "Code executed but no data returned. Did you forget to return the array?" };
             }
          }
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
