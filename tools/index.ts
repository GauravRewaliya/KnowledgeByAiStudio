import { getHarStructureToolDefinition, getHarStructureImpl } from "./harStructure";
import { inspectEntrySchemaToolDefinition, inspectEntrySchemaImpl } from "./entryInspector";
import { runExtractionCodeToolDefinition, runExtractionCodeImpl } from "./dataExtractor";
import { ToolDefinition, ToolFunction } from "../types/ai";

export const allToolDefinitions: ToolDefinition[] = [
  getHarStructureToolDefinition,
  inspectEntrySchemaToolDefinition,
  runExtractionCodeToolDefinition,
];

// Map of tool names to their implementations
export const toolImplementations: { [key: string]: ToolFunction<any, any> } = {
  get_har_structure: getHarStructureImpl,
  inspect_entry_schema: inspectEntrySchemaImpl,
  run_extraction_code: runExtractionCodeImpl,
};
