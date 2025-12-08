
export const DEFAULT_CONFIG = {
    // Backend Proxy (Ruby on Rails)
    BACKEND_URL: 'https://9990c1cj-4999.inc1.devtunnels.ms',
    
    // Neo4j Configuration
    // Note: If 'bolt://' fails over the tunnel, try 'neo4j+s://' or 'bolt+s://'
    // and ensure the tunnel supports TCP or WebSocket forwarding for the driver.
    NEO4J_URI: 'bolt://9990c1cj-7687.inc1.devtunnels.ms', 
    NEO4J_USER: 'neo4j',
    NEO4J_PASSWORD: 'password', 
    NEO4J_BROWSER_URL: 'https://9990c1cj-7474.inc1.devtunnels.ms'
};

console.log("HarMind Config Loaded (Static):", DEFAULT_CONFIG);
