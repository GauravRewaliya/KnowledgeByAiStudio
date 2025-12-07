import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Type } from "@google/genai";
import { KnowledgeGraphData, HarEntryWrapper } from "../types";
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
          // Add other properties if needed for the model's understanding
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
  onDataExtracted?: (data: any[]) => void
): Promise<string> => {
  const ai = getAiClient();
  const model = "gemini-2.5-flash";

  const systemInstruction = `
    You are HarMind, an expert Network Analyst AI.
    You have access to a HAR file loaded in memory.
    
    YOUR GOAL: Help the user extract insights or specific data from the HAR file.
    
    WORKFLOW:
    1. Start by calling 'get_har_structure' to see what requests are available.
    2. Analyze the URLs to find relevant API calls (e.g., /api/projects, /graphql).
    3. Call 'inspect_entry_schema' on interesting entries (by their '_index') to understand their JSON response structure.
    4. IF the user wants to extract data (like "get all project IDs"), WRITE JavaScript code and call 'run_extraction_code'.
       - The code you write has access to 'entries' variable (containing HarEntryWrapper objects).
       - You MUST push extracted data objects to the 'results' array in your code.
       - Example: entries.forEach(e => { try { const json = JSON.parse(e.response.content.text); if(json.data) results.push(json.data); } catch(err){} });
    
    CONSTRAINTS:
    - Do NOT ask the user to paste JSON. You have the tools to read it.
    - If a response is huge, the schema tool only shows a sample structure. This is enough to write the extraction code.
    - Be concise in your text responses.
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
      let result: any = { error: "Unknown function" };

      console.log(`[Agent] Calling tool: ${name}`, args);

      try {
        const toolFunc = toolImplementations[name];
        if (toolFunc) {
          result = toolFunc(harData, args);
          if (name === 'run_extraction_code' && result.success && onDataExtracted) {
             onDataExtracted(result.data);
             result = { success: true, count: result.data.length, sample: result.data.slice(0, 2) };
          }
        } else {
          result = { error: `Tool '${name}' not implemented.` };
        }
      } catch (e: any) {
        result = { error: e.message };
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

  return response.text || "I processed that but have no text response.";
};
