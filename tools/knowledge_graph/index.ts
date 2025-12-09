
import { ToolDefinition, ToolFunction } from "../../types/ai";
import { Type } from "@google/genai";
import { useProjectStore } from "../../store/projectStore";
import { runCypherQuery } from "../../services/neo4jService";

// --- Look Entities ---
export const kgLookEntitiesDef: ToolDefinition = {
    name: "kg_look_entities",
    description: "List all entities (nodes) in the graph. Can optionally return structure (data keys).",
    parameters: {
        type: Type.OBJECT,
        properties: {
            structure: { type: Type.BOOLEAN, description: "If true, includes data keys for each node.", optional: true }
        },
        required: []
    }
};

export const kgLookEntitiesImpl: ToolFunction<{ structure?: boolean }, any> = (_h, args) => {
    const store = useProjectStore.getState();
    const nodes = store.activeProject?.knowledgeData.nodes || [];
    
    if (args.structure) {
        return nodes.map(n => ({ 
            id: n.id, 
            type: n.type, 
            label: n.label, 
            data_keys: Object.keys(n.data || {}) 
        }));
    }

    return nodes.map(n => ({ id: n.id, label: n.label, type: n.type }));
};

// --- Look One Entity ---
export const kgLookEntityElementDef: ToolDefinition = {
    name: "kg_look_entity_element",
    description: "Inspect full data of a specific entity/node.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING, description: "Node ID" }
        },
        required: ["id"]
    }
};

export const kgLookEntityElementImpl: ToolFunction<{ id: string }, any> = (_h, args) => {
    const store = useProjectStore.getState();
    const node = store.activeProject?.knowledgeData.nodes.find(n => n.id === args.id);
    return node || { error: "Node not found" };
};

// --- Create Node ---
export const kgCreateNodeDef: ToolDefinition = {
    name: "kg_create_node",
    description: "Add a new node to the Knowledge Graph.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            label: { type: Type.STRING, description: "Display name" },
            type: { type: Type.STRING, description: "Category/Type" },
            data: { type: Type.OBJECT, description: "Properties" },
            id: { type: Type.STRING, description: "Optional ID", optional: true }
        },
        required: ["label", "type", "data"]
    }
};

export const kgCreateNodeImpl: ToolFunction<{ label: string, type: string, data: any, id?: string }, any> = (_h, args) => {
    const store = useProjectStore.getState();
    const newId = args.id || `node-${Date.now()}-${Math.random().toString(36).substr(2,5)}`;
    
    store.setKnowledgeData(prev => ({
        ...prev,
        nodes: [...prev.nodes, { id: newId, type: args.type, label: args.label, data: args.data }]
    }));
    return { success: true, id: newId };
};

// --- Create Relation ---
export const kgCreateRelationDef: ToolDefinition = {
    name: "kg_create_relation",
    description: "Create a directed link between two nodes.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            source_id: { type: Type.STRING },
            target_id: { type: Type.STRING },
            relation: { type: Type.STRING, description: "Relationship label" }
        },
        required: ["source_id", "target_id", "relation"]
    }
};

export const kgCreateRelationImpl: ToolFunction<{ source_id: string, target_id: string, relation: string }, any> = (_h, args) => {
    const store = useProjectStore.getState();
    store.setKnowledgeData(prev => ({
        ...prev,
        links: [...prev.links, { source: args.source_id, target: args.target_id, label: args.relation }]
    }));
    return { success: true };
};

// --- Fetch Nodes (Query) ---
export const kgFetchNodesDef: ToolDefinition = {
    name: "kg_fetch_nodes",
    description: "Query the graph. Provide 'query_str' for local search or 'cypher' for Neo4j.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            query_str: { type: Type.STRING, description: "Search term" },
            cypher: { type: Type.BOOLEAN, description: "If true, treats query_str as Cypher query.", optional: true }
        },
        required: ["query_str"]
    }
};

export const kgFetchNodesImpl: ToolFunction<{ query_str: string, cypher?: boolean }, any> = async (_h, args) => {
    const store = useProjectStore.getState();
    
    if (args.cypher) {
        try {
            const results = await runCypherQuery(args.query_str);
            return { type: 'cypher_result', count: results.length, data: results };
        } catch (e: any) {
            return { error: `Cypher execution failed: ${e.message}` };
        }
    } else {
        // Simple local filter
        const term = args.query_str.toLowerCase();
        const nodes = store.activeProject?.knowledgeData.nodes || [];
        const matches = nodes.filter(n => 
            n.label.toLowerCase().includes(term) || 
            n.type.toLowerCase().includes(term) ||
            JSON.stringify(n.data).toLowerCase().includes(term)
        );
        return { type: 'local_search', count: matches.length, nodes: matches.map(n => ({ id: n.id, label: n.label })) };
    }
};
