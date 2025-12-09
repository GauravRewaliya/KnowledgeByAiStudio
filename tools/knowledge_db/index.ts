
import { ToolDefinition, ToolFunction } from "../../types/ai";
import { Type } from "@google/genai";
import { useProjectStore } from "../../store/projectStore";
import { ProcessingStatus } from "../../types";
import { extractFirstArray, extractFirstObject, truncateContent } from "../../services/harUtils";

// --- Look Tables ---
export const dbListTablesDef: ToolDefinition = {
    name: "db_look_tables",
    description: "Look at the Knowledge DB tables/groups. Returns grouped summary with [status, primary_filter_json, group_slug].",
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
        
        const slug = e.source_type_key;
        if (!groups[slug]) {
            groups[slug] = {
                count: 0,
                status: e.processing_status,
                primary_filter_json: e.filterer_json || {}
            };
        }
        groups[slug].count++;
        
        // If this entry is more 'advanced' or has a filter, prioritize showing it
        if (e.processing_status === ProcessingStatus.FinalResponse || Object.keys(e.filterer_json).length > 0) {
             groups[slug].status = e.processing_status;
             groups[slug].primary_filter_json = e.filterer_json;
        }
    });

    return Object.entries(groups).map(([slug, data]) => ({
        group_slug: slug,
        status: data.status,
        primary_filter_json: data.primary_filter_json,
        count: data.count
    }));
};

// --- Look Request (Combined) ---
export const dbLookRequestDef: ToolDefinition = {
    name: "db_look_request",
    description: "Inspect a request in the Knowledge DB. Modes: 'structure' (simplified schema), 'sample' (first items of arrays), 'content' (full raw JSON).",
    parameters: {
        type: Type.OBJECT,
        properties: {
            row_id: { type: Type.STRING, description: "The UUID of the scraping entry." },
            structure: { type: Type.BOOLEAN, description: "Returns simplified structure (v2 logic).", optional: true },
            sample: { type: Type.BOOLEAN, description: "Returns sample data (v1 logic - 1st array item).", optional: true },
            content: { type: Type.BOOLEAN, description: "Returns exact content (raw).", optional: true }
        },
        required: ["row_id"]
    }
};

export const dbLookRequestImpl: ToolFunction<{ row_id: string, structure?: boolean, sample?: boolean, content?: boolean }, any> = (_h, args) => {
    const store = useProjectStore.getState();
    const entry = store.activeProject?.scrapingEntries.find(e => e.id === args.row_id);
    
    if (!entry) return { error: "Entry not found" };
    
    // Parse response content
    let jsonBody: any = {};
    const rawContent = (entry.response as any).content?.text || JSON.stringify(entry.response);
    try {
        jsonBody = JSON.parse(rawContent);
    } catch {
        jsonBody = { error: "Could not parse JSON", raw: truncateContent(rawContent, 200) };
    }

    if (args.content) {
         return {
            json_structure: jsonBody,
            full_response: true
        };
    }

    if (args.structure) {
        // extract_first_object (v2) logic
        return extractFirstObject(jsonBody);
    }

    if (args.sample) {
        // extract_first_array (v1) logic
        return extractFirstArray(jsonBody);
    }

    // Default fallback
    return extractFirstObject(jsonBody);
};

// --- Update Row ---
export const dbUpdateRowDef: ToolDefinition = {
    name: "db_update_row",
    description: "Update a scraping entry (row). Can update processing step (status), converter code, or filter JSON.",
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
