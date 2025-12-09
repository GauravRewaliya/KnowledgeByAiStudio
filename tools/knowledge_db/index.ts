
import { ToolDefinition, ToolFunction } from "../../types/ai";
import { Type } from "@google/genai";
import { useProjectStore } from "../../store/projectStore";
import { ProcessingStatus } from "../../types";
import { extractFirstObject, truncateContent } from "../../services/harUtils";

// --- Look Tables ---
export const dbListTablesDef: ToolDefinition = {
    name: "db_look_tables",
    description: "List grouping tables (group_slugs) from the Knowledge DB. Returns status, primary filter info, and counts.",
    parameters: {
        type: Type.OBJECT,
        properties: {},
        required: []
    }
};

export const dbListTablesImpl: ToolFunction<{}, any> = () => {
    const store = useProjectStore.getState();
    const entries = store.activeProject?.scrapingEntries || [];
    
    // Group by source_type_key
    const groups: Record<string, { count: number, status: string, primary_filter_json: any }> = {};
    
    entries.forEach(e => {
        if (e.is_deleted) return;
        
        if (!groups[e.source_type_key]) {
            groups[e.source_type_key] = {
                count: 0,
                status: e.processing_status,
                primary_filter_json: e.filterer_json || {}
            };
        }
        groups[e.source_type_key].count++;
        // If any in group is final, mark group as such (simplification)
        if (e.processing_status === ProcessingStatus.FinalResponse) {
             groups[e.source_type_key].status = ProcessingStatus.FinalResponse;
             groups[e.source_type_key].primary_filter_json = e.filterer_json;
        }
    });

    return Object.entries(groups).map(([slug, data]) => ({
        group_slug: slug,
        ...data
    }));
};

// --- Look Request (Structure, Sample, Content) ---
export const dbLookRequestDef: ToolDefinition = {
    name: "db_look_request",
    description: "Inspect a specific request in the Knowledge DB. 'structure' returns simplified schema (arrays=1 item). 'sample' returns simplified data. 'content' returns exact raw JSON (use carefully).",
    parameters: {
        type: Type.OBJECT,
        properties: {
            row_id: { type: Type.STRING, description: "The UUID of the scraping entry." },
            mode: { type: Type.STRING, description: "One of: 'structure', 'sample', 'content'" }
        },
        required: ["row_id", "mode"]
    }
};

export const dbLookRequestImpl: ToolFunction<{ row_id: string, mode: 'structure' | 'sample' | 'content' }, any> = (_h, args) => {
    const store = useProjectStore.getState();
    const entry = store.activeProject?.scrapingEntries.find(e => e.id === args.row_id);
    
    if (!entry) return { error: "Entry not found" };
    
    // Parse response content
    let jsonBody = {};
    const rawText = (entry.response as any).content?.text || JSON.stringify(entry.response);
    try {
        jsonBody = JSON.parse(rawText);
    } catch {
        jsonBody = { error: "Could not parse JSON", raw: truncateContent(rawText, 200) };
    }

    if (args.mode === 'structure' || args.mode === 'sample') {
        // Use the recursive simplification logic
        return {
            id: entry.id,
            url: entry.url,
            // Structure/Sample logic is handled by extractFirstObject which truncates arrays to 1 item
            data: extractFirstObject(jsonBody)
        };
    } 
    
    if (args.mode === 'content') {
        return {
            id: entry.id,
            json_structure: jsonBody,
            full_response: true
        };
    }

    return { error: "Invalid mode" };
};

// --- Update Row ---
export const dbUpdateRowDef: ToolDefinition = {
    name: "db_update_row",
    description: "Update a scraping entry (row). Can update processing step, converter code, or filter JSON.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            row_id: { type: Type.STRING, description: "Entry UUID" },
            step: { type: Type.STRING, description: "Processing Status enum value", optional: true },
            converter_code: { type: Type.STRING, description: "JS Code", optional: true },
            filterer_json: { type: Type.OBJECT, description: "Filter Schema", optional: true }
        },
        required: ["row_id"]
    }
};

export const dbUpdateRowImpl: ToolFunction<{ row_id: string, step?: string, converter_code?: string, filterer_json?: any }, any> = (_h, args) => {
    const store = useProjectStore.getState();
    store.updateScrapingEntry(args.row_id, {
        ...(args.step && { processing_status: args.step as ProcessingStatus }),
        ...(args.converter_code && { converter_code: args.converter_code }),
        ...(args.filterer_json && { filterer_json: args.filterer_json })
    });
    return { success: true, row_id: args.row_id };
};

// --- Delete Row ---
export const dbDeleteRowDef: ToolDefinition = {
    name: "db_delete_row",
    description: "Soft delete a row in the Knowledge DB (sets is_deleted=true).",
    parameters: {
        type: Type.OBJECT,
        properties: {
            row_id: { type: Type.STRING, description: "Entry UUID" }
        },
        required: ["row_id"]
    }
};

export const dbDeleteRowImpl: ToolFunction<{ row_id: string }, any> = (_h, args) => {
    const store = useProjectStore.getState();
    store.updateScrapingEntry(args.row_id, { is_deleted: true });
    return { success: true, message: "Row marked as deleted." };
};
