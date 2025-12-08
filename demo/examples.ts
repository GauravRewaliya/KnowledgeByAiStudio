import { ProjectBackup } from "../types";

export interface DemoProject {
    id: string;
    title: string;
    description: string;
    tags: string[];
    colorFrom: string;
    colorTo: string;
    data: ProjectBackup;
}

// PASTE YOUR JSON DEMO DATA INSIDE THE 'data' FIELD OF THESE OBJECTS
export const DEMO_EXAMPLES: DemoProject[] = [
    {
        id: 'demo-ecommerce',
        title: 'E-Commerce Audit',
        description: 'Analyze product API calls and cart interactions from a standard shopping session.',
        tags: ['E-Commerce', 'API Audit'],
        colorFrom: 'from-blue-600',
        colorTo: 'to-cyan-500',
        data: {
             version: "1.0",
             timestamp: new Date().toISOString(),
             name: "Demo: E-Commerce Audit",
             harEntries: [], // <--- PASTE YOUR HAR ENTRIES OR FULL BACKUP HERE
             knowledgeData: { nodes: [], links: [] },
             chatHistory: [{ role: 'model', text: 'Welcome to the E-Commerce demo! I can help you extract product details or analyze cart latency.' }],
             scrapingEntries: [],
             browserSessions: []
        }
    },
    {
        id: 'demo-auth',
        title: 'Auth Flow Trace',
        description: 'Debugging OAuth2 sequence and token exchange patterns.',
        tags: ['Security', 'OAuth'],
        colorFrom: 'from-purple-600',
        colorTo: 'to-pink-500',
        data: {
             version: "1.0",
             timestamp: new Date().toISOString(),
             name: "Demo: Auth Flow",
             harEntries: [], // <--- PASTE YOUR HAR ENTRIES OR FULL BACKUP HERE
             knowledgeData: { nodes: [], links: [] },
             chatHistory: [{ role: 'model', text: 'Ready to analyze authentication headers. Ask me to find the bearer token exchange.' }],
             scrapingEntries: [],
             browserSessions: []
        }
    },
    {
        id: 'demo-social',
        title: 'Social Feed Logic',
        description: 'Reverse engineering feed pagination and ad injection logic.',
        tags: ['Social', 'Reverse Eng'],
        colorFrom: 'from-orange-500',
        colorTo: 'to-red-500',
        data: {
             version: "1.0",
             timestamp: new Date().toISOString(),
             name: "Demo: Social Feed",
             harEntries: [], // <--- PASTE YOUR HAR ENTRIES OR FULL BACKUP HERE
             knowledgeData: { nodes: [], links: [] },
             chatHistory: [],
             scrapingEntries: [],
             browserSessions: []
        }
    }
];
