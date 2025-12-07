import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Schema, Type } from "@google/genai";
import { KnowledgeGraphData, HarEntryWrapper } from "../types";
import { getHarStructure, getEntryDetails, runExtractionCode } from "./harTools";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please set process.env.API_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Tool Definitions ---

const toolsDef = [
  {
    functionDeclarations: [
      {
        name: "get_har_structure",
        description: "Get a list of all requests in the HAR file. Returns index, method, url, status, type.",
      },
      {
        name: "inspect_entry_schema",
        description: "Get the detailed JSON SCHEMA/Structure of a specific HAR entry. Use this to understand the data shape before extracting. Arrays are truncated.",
        parameters: {
          type: Type.OBJECT,
          properties: {
             index: { type: Type.NUMBER, description: "The _index of the entry to inspect" }
          },
          required: ["index"]
        }
      },
      {
        name: "run_extraction_code",
        description: "Execute JavaScript code to extract data from the HAR entries. The code has access to an `entries` array. Push objects to `results` array.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            code: { 
              type: Type.STRING, 
              description: "JavaScript code. Example: entries.forEach(e => { if(e.request.url.includes('api')) results.push({ url: e.request.url }) })" 
            }
          },
          required: ["code"]
        }
      }
    ]
  }
];

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
    1. Usually start by calling 'get_har_structure' to see what requests are available.
    2. Analyze the URLs to find relevant API calls (e.g., /api/projects, /graphql).
    3. Call 'inspect_entry_schema' on interesting entries to understand their JSON response structure.
    4. IF the user wants to extract data (like "get all project IDs"), WRITE JavaScript code and call 'run_extraction_code'.
       - The code you write has access to 'entries' variable.
       - You MUST push data to the 'results' array in your code.
       - Example: entries.forEach(e => { try { const json = JSON.parse(e.response.content.text); if(json.data) results.push(json.data); } catch(err){} });
    
    CONSTRAINTS:
    - Do NOT ask the user to paste JSON. You have the tools to read it.
    - If a response is huge, the schema tool only shows a sample. This is enough to write the extraction code.
    - Be concise in your text responses.
  `;

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction,
      tools: toolsDef,
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
        if (name === 'get_har_structure') {
          result = getHarStructure(harData).slice(0, 50); // Limit to first 50 for token sanity, or maybe filter?
          if (getHarStructure(harData).length > 50) {
              result.push({ warning: "List truncated. Total entries: " + harData.length });
          }
        } else if (name === 'inspect_entry_schema') {
          result = getEntryDetails(harData, args.index);
        } else if (name === 'run_extraction_code') {
          const execResult = runExtractionCode(harData, args.code);
          if (execResult.success && onDataExtracted) {
             onDataExtracted(execResult.data);
             result = { success: true, count: execResult.data.length, sample: execResult.data.slice(0, 2) };
          } else {
             result = execResult;
          }
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
