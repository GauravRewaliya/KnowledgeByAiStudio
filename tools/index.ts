
import { getHarStructureToolDefinition, getHarStructureImpl } from "./harStructure";
import { inspectEntrySchemaToolDefinition, inspectEntrySchemaImpl } from "./entryInspector";
import { runExtractionCodeToolDefinition, runExtractionCodeImpl } from "./dataExtractor";
import { getResponseContentToolDefinition, getResponseContentImpl } from "./contentFetcher";
import { 
  findSimilarParserToolDefinition, findSimilarParserImpl,
  updateScrapingEntryToolDefinition, updateScrapingEntryImpl,
  deleteScrapingEntryToolDefinition, deleteScrapingEntryImpl,
  executeProxyRequestToolDefinition, executeProxyRequestImpl
} from "./scrapingTools";
import { ToolDefinition, ToolFunction } from "../types/ai";

export const allToolDefinitions: ToolDefinition[] = [
  getHarStructureToolDefinition,
  inspectEntrySchemaToolDefinition,
  getResponseContentToolDefinition,
  runExtractionCodeToolDefinition,
  findSimilarParserToolDefinition,
  updateScrapingEntryToolDefinition,
  deleteScrapingEntryToolDefinition,
  executeProxyRequestToolDefinition
];

// Map of tool names to their implementations
export const toolImplementations: { [key: string]: ToolFunction<any, any> } = {
  get_har_structure: getHarStructureImpl,
  inspect_entry_schema: inspectEntrySchemaImpl,
  get_response_content: getResponseContentImpl,
  run_extraction_code: runExtractionCodeImpl,
  find_similar_parser: findSimilarParserImpl,
  update_scraping_entry: updateScrapingEntryImpl,
  delete_scraping_entry: deleteScrapingEntryImpl,
  execute_proxy_request: executeProxyRequestImpl as any, // Cast due to async
};
