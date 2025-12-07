import { ToolDefinition, ToolFunction } from "../types/ai";
import { Type } from "@google/genai";
import { HarEntryWrapper } from "../types";
import { getHarStructureSummary } from "../services/harUtils";

// Define the shape of the summarized HAR entry returned by getHarStructureSummary
interface HarEntrySummary {
  index: number;
  id: string;
  method: string;
  url: string;
  status: number;
  size: number;
  mimeType: string;
  isGraphQL: boolean;
}

export const getHarStructureToolDefinition: ToolDefinition = {
  name: "get_har_structure",
  description: "Get a list of all requests in the HAR file. Returns _index, method, url, status, size, mimeType, and whether it's a GraphQL request. By default, returns only selected entries; if no entries are selected, it returns all.",
  parameters: {
    type: Type.OBJECT,
    properties: {}, // No direct parameters for this function
    required: []
  }
};

// Fix: Update the return type of ToolFunction to match the actual output of getHarStructureSummary
export const getHarStructureImpl: ToolFunction<{}, HarEntrySummary[]> = (harEntries, args) => {
  return getHarStructureSummary(harEntries);
};