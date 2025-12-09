
import { ToolDefinition, ToolFunction } from "../types/ai";
import { executeProxyRequestToolDefinition, executeProxyRequestImpl } from "./proxy/request";

// Knowledge DB
import { 
    dbListTablesDef, dbListTablesImpl,
    dbLookRequestDef, dbLookRequestImpl,
    dbUpdateRowDef, dbUpdateRowImpl,
    dbDeleteRowDef, dbDeleteRowImpl
} from "./knowledge_db/index";

// Knowledge Graph
import {
    kgLookEntitiesDef, kgLookEntitiesImpl,
    kgLookEntityElementDef, kgLookEntityElementImpl,
    kgCreateNodeDef, kgCreateNodeImpl,
    kgCreateRelationDef, kgCreateRelationImpl,
    kgFetchNodesDef, kgFetchNodesImpl
} from "./knowledge_graph/index";


export const allToolDefinitions: ToolDefinition[] = [
  // Proxy
  executeProxyRequestToolDefinition,

  // Knowledge DB
  dbListTablesDef,
  dbLookRequestDef,
  dbUpdateRowDef,
  dbDeleteRowDef,

  // Knowledge Graph
  kgLookEntitiesDef,
  kgLookEntityElementDef,
  kgCreateNodeDef,
  kgCreateRelationDef,
  kgFetchNodesDef
];

// Map of tool names to their implementations
export const toolImplementations: { [key: string]: ToolFunction<any, any> } = {
  // Proxy
  execute_proxy_request: executeProxyRequestImpl as any,

  // Knowledge DB
  db_look_tables: dbListTablesImpl,
  db_look_request: dbLookRequestImpl,
  db_update_row: dbUpdateRowImpl,
  db_delete_row: dbDeleteRowImpl,

  // Knowledge Graph
  kg_look_entities: kgLookEntitiesImpl,
  kg_look_entity_element: kgLookEntityElementImpl,
  kg_create_node: kgCreateNodeImpl,
  kg_create_relation: kgCreateRelationImpl,
  kg_fetch_nodes: kgFetchNodesImpl as any // async
};
