
import type { Driver } from 'neo4j-driver';

// Use a dynamic import for the driver to prevent load-time errors
// if the module resolution fails or environment is incompatible.
let driverInstance: Driver | null = null;
let neo4jModule: any = null;

const loadNeo4jModule = async () => {
    if (!neo4jModule) {
        try {
            // @ts-ignore
            neo4jModule = await import('neo4j-driver');
        } catch (e) {
            console.error("Could not load neo4j-driver module:", e);
            throw new Error("Failed to load Neo4j driver library.");
        }
    }
    
    // Handle potential default export wrapper (common in some CDN bundles)
    const driverFactory = neo4jModule.driver || neo4jModule.default?.driver;
    const authFactory = neo4jModule.auth || neo4jModule.default?.auth;
    
    if (!driverFactory || !authFactory) {
        throw new Error("Neo4j driver module loaded but exports are missing.");
    }
    
    return { driver: driverFactory, auth: authFactory };
};

export const initNeo4jDriver = async (uri: string, user: string, password: string): Promise<boolean> => {
    if (driverInstance) {
        await driverInstance.close();
    }
    
    try {
        const { driver, auth } = await loadNeo4jModule();
        driverInstance = driver(uri, auth.basic(user, password));
        
        if (driverInstance) {
             await driverInstance.verifyConnectivity();
             return true;
        }
        return false;
    } catch (error) {
        console.error("Neo4j Connection Failed:", error);
        driverInstance = null;
        return false;
    }
};

export const getNeo4jDriver = () => driverInstance;

export const runCypherQuery = async (query: string, params: Record<string, any> = {}) => {
    if (!driverInstance) throw new Error("Neo4j driver not initialized or connected.");
    
    const session = driverInstance.session();
    try {
        const result = await session.run(query, params);
        return result.records.map((record: any) => record.toObject());
    } finally {
        await session.close();
    }
};

export const syncNodeToNeo4j = async (label: string, data: any) => {
    const query = `
        MERGE (n:${label} {id: $id})
        SET n += $props
        RETURN n
    `;
    const { id, ...props } = data;
    // Ensure id is present
    if (!id) throw new Error("Node data must have an 'id' field.");
    
    // Flatten nested objects or stringify them for Neo4j properties
    const safeProps = Object.entries(props).reduce((acc: any, [key, val]) => {
        acc[key] = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
        return acc;
    }, {});

    return runCypherQuery(query, { id, props: safeProps });
};
