
import { create } from 'zustand';
import { ProjectState, ProjectData, ProjectMetadata, ViewMode, HarFile, HarEntryWrapper, KnowledgeGraphData, ChatMessage, ProjectBackup, ScrapingEntry, ProcessingStatus, BrowserSession, Neo4jConfig } from '../types';
import { storageService } from '../services/storageService';
import { DEFAULT_CONFIG } from '../services/config';

// Debounce helper for auto-save
let saveTimeout: any = null;
const debouncedSave = (project: ProjectData) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        storageService.saveProject(project).catch(console.error);
    }, 1000);
};

export const useProjectStore = create<ProjectState>((set, get) => ({
    projects: [],
    activeProjectId: null,
    activeProject: null,
    viewMode: ViewMode.PROJECTS,
    isLoading: false,
    error: null,

    init: async () => {
        try {
            set({ isLoading: true });
            const projects = await storageService.getAllMetadata();
            // Sort by updated recently
            projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            set({ projects, isLoading: false });
        } catch (e: any) {
            set({ error: "Failed to load projects: " + e.message, isLoading: false });
        }
    },

    createProject: async (name: string, initialHarFile?: File) => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        
        let harEntries: HarEntryWrapper[] = [];
        
        if (initialHarFile) {
            try {
                const text = await initialHarFile.text();
                const parsed: HarFile = JSON.parse(text);
                const harId = Math.random().toString(36).substr(2, 9);
                harEntries = parsed.log.entries.map((entry, idx) => ({
                    ...entry,
                    _index: idx,
                    _id: `entry-${harId}-${idx}`,
                    _selected: false,
                    _harId: harId,
                    _harName: initialHarFile.name
                }));
            } catch (e) {
                console.error("Failed to parse initial HAR", e);
            }
        }

        const newProject: ProjectData = {
            id,
            name,
            createdAt: now,
            updatedAt: now,
            requestCount: harEntries.length,
            entityCount: 0,
            size: 0,
            harEntries,
            knowledgeData: { nodes: [], links: [] },
            chatHistory: [{ role: 'model', text: 'Project created. Ready to analyze.' }],
            scrapingEntries: [],
            browserSessions: [{ id: crypto.randomUUID(), name: 'Default Session', createdAt: now }],
            backendUrl: DEFAULT_CONFIG.BACKEND_URL,
            neo4jConfig: {
                uri: DEFAULT_CONFIG.NEO4J_URI,
                user: DEFAULT_CONFIG.NEO4J_USER,
                password: DEFAULT_CONFIG.NEO4J_PASSWORD,
                browserUrl: DEFAULT_CONFIG.NEO4J_BROWSER_URL
            }
        };

        await storageService.saveProject(newProject);
        
        set(state => ({
            projects: [newProject, ...state.projects],
            activeProjectId: id,
            activeProject: newProject,
            viewMode: ViewMode.EXPLORE
        }));
    },

    importProjectFromFile: async (file: File) => {
        try {
            set({ isLoading: true });
            const text = await file.text();
            const backup: ProjectBackup = JSON.parse(text);
            
            await get().createProjectFromBackup(backup);
        } catch (e: any) {
            set({ error: "Failed to import project: " + e.message, isLoading: false });
        }
    },

    createProjectFromBackup: async (backup: ProjectBackup) => {
        try {
            if (!backup.harEntries || !backup.knowledgeData) {
                throw new Error("Invalid backup format: missing HAR entries or Knowledge Graph.");
            }

            const id = crypto.randomUUID();
            const now = new Date().toISOString();

            // Sanitize entries to ensure unique IDs if imported multiple times
            const harId = Math.random().toString(36).substr(2, 9);
            const sanitizedEntries = (backup.harEntries || []).map((entry, idx) => ({
                ...entry,
                _harId: harId, // Overwrite HAR ID to avoid collisions
                _id: `entry-${harId}-${idx}` // Regenerate internal ID
            }));

            const newProject: ProjectData = {
                id,
                name: backup.name || 'Imported Project',
                createdAt: backup.timestamp || now,
                updatedAt: now,
                requestCount: sanitizedEntries.length,
                entityCount: backup.knowledgeData.nodes.length,
                size: 0, // Recalculated on save
                harEntries: sanitizedEntries,
                knowledgeData: backup.knowledgeData,
                chatHistory: backup.chatHistory || [],
                scrapingEntries: backup.scrapingEntries || [],
                browserSessions: backup.browserSessions || [{ id: crypto.randomUUID(), name: 'Default Session', createdAt: now }],
                backendUrl: backup.backendUrl || DEFAULT_CONFIG.BACKEND_URL,
                neo4jConfig: backup.neo4jConfig || {
                    uri: DEFAULT_CONFIG.NEO4J_URI,
                    user: DEFAULT_CONFIG.NEO4J_USER,
                    password: DEFAULT_CONFIG.NEO4J_PASSWORD,
                    browserUrl: DEFAULT_CONFIG.NEO4J_BROWSER_URL
                }
            };

            await storageService.saveProject(newProject);
            
            // Refresh list
            const projects = await storageService.getAllMetadata();
            projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            
            set({ 
                projects, 
                isLoading: false,
                activeProjectId: id,
                activeProject: newProject,
                viewMode: ViewMode.EXPLORE
            });
        } catch (e: any) {
            set({ error: "Failed to create project from backup: " + e.message, isLoading: false });
        }
    },

    renameProject: async (id: string, newName: string) => {
        try {
            const project = await storageService.getProject(id);
            if (!project) return;

            const updatedProject = { ...project, name: newName, updatedAt: new Date().toISOString() };
            await storageService.saveProject(updatedProject);

            set(state => ({
                projects: state.projects.map(p => p.id === id ? { ...p, name: newName, updatedAt: updatedProject.updatedAt } : p)
            }));

            if (get().activeProjectId === id) {
                set({ activeProject: updatedProject });
            }
        } catch (e: any) {
            console.error("Failed to rename project", e);
        }
    },

    openProject: async (id: string) => {
        try {
            set({ isLoading: true, error: null });
            const project = await storageService.getProject(id);
            if (!project) throw new Error("Project not found");
            
            // Ensure schema compatibility
            if (!project.scrapingEntries) project.scrapingEntries = [];
            if (!project.browserSessions) project.browserSessions = [{ id: crypto.randomUUID(), name: 'Default Session', createdAt: new Date().toISOString() }];
            if (!project.backendUrl) project.backendUrl = DEFAULT_CONFIG.BACKEND_URL;
            if (!project.neo4jConfig) {
                 project.neo4jConfig = {
                    uri: DEFAULT_CONFIG.NEO4J_URI,
                    user: DEFAULT_CONFIG.NEO4J_USER,
                    password: DEFAULT_CONFIG.NEO4J_PASSWORD,
                    browserUrl: DEFAULT_CONFIG.NEO4J_BROWSER_URL
                 };
            }
            
            set({ 
                activeProjectId: id, 
                activeProject: project, 
                viewMode: ViewMode.EXPLORE,
                isLoading: false 
            });
        } catch (e: any) {
            set({ error: e.message, isLoading: false });
        }
    },

    closeProject: () => {
        set({ 
            activeProjectId: null, 
            activeProject: null, 
            viewMode: ViewMode.PROJECTS 
        });
        get().init(); 
    },

    deleteProject: async (id: string) => {
        if (get().activeProjectId === id) {
            get().closeProject();
        }
        await storageService.deleteProject(id);
        set(state => ({
            projects: state.projects.filter(p => p.id !== id)
        }));
    },

    setViewMode: (mode: ViewMode) => {
        set({ viewMode: mode });
    },

    // --- Active Project Data Actions ---

    addHarFile: async (file: File) => {
        const store = get();
        if (!store.activeProject) return;

        try {
            const text = await file.text();
            const parsed: HarFile = JSON.parse(text);
            const harId = Math.random().toString(36).substr(2, 9);
            const currentEntries = store.activeProject.harEntries;
            
            const newEntries: HarEntryWrapper[] = parsed.log.entries.map((entry, idx) => ({
                ...entry,
                _index: currentEntries.length + idx,
                _id: `entry-${harId}-${idx}`,
                _selected: false,
                _harId: harId,
                _harName: file.name
            }));

            const updatedProject = {
                ...store.activeProject,
                harEntries: [...currentEntries, ...newEntries],
                updatedAt: new Date().toISOString()
            };

            set({ activeProject: updatedProject });
            debouncedSave(updatedProject);
        } catch (e: any) {
            set({ error: "Failed to add HAR file: " + e.message });
            setTimeout(() => set({ error: null }), 3000);
        }
    },

    setHarEntries: (entries: HarEntryWrapper[]) => {
        const store = get();
        if (!store.activeProject) return;

        const updatedProject = {
            ...store.activeProject,
            harEntries: entries,
            updatedAt: new Date().toISOString()
        };
        set({ activeProject: updatedProject });
        debouncedSave(updatedProject);
    },

    setKnowledgeData: (dataOrFn) => {
        const store = get();
        if (!store.activeProject) return;

        const newData = typeof dataOrFn === 'function' ? dataOrFn(store.activeProject.knowledgeData) : dataOrFn;
        
        const updatedProject = {
            ...store.activeProject,
            knowledgeData: newData,
            updatedAt: new Date().toISOString()
        };
        set({ activeProject: updatedProject });
        debouncedSave(updatedProject);
    },

    setChatMessages: (msgsOrFn) => {
        const store = get();
        if (!store.activeProject) return;

        const newMsgs = typeof msgsOrFn === 'function' ? msgsOrFn(store.activeProject.chatHistory) : msgsOrFn;

        const updatedProject = {
            ...store.activeProject,
            chatHistory: newMsgs,
            updatedAt: new Date().toISOString()
        };
        set({ activeProject: updatedProject });
        debouncedSave(updatedProject);
    },

    importProjectData: async (backup: ProjectBackup) => {
        const store = get();
        if (!store.activeProject) return;
        
        const updatedProject: ProjectData = {
            ...store.activeProject,
            harEntries: backup.harEntries || [],
            knowledgeData: backup.knowledgeData || { nodes: [], links: [] },
            chatHistory: backup.chatHistory || [],
            scrapingEntries: backup.scrapingEntries || [],
            browserSessions: backup.browserSessions || store.activeProject.browserSessions,
            backendUrl: backup.backendUrl || store.activeProject.backendUrl,
            neo4jConfig: backup.neo4jConfig || store.activeProject.neo4jConfig,
            updatedAt: new Date().toISOString()
        };

        set({ activeProject: updatedProject });
        await storageService.saveProject(updatedProject); 
    },

    // --- Knowledge DB Actions ---

    syncHarToDb: (entries: HarEntryWrapper[]) => {
        const store = get();
        if (!store.activeProject) return;

        const newScrapingEntries: ScrapingEntry[] = entries.map(e => {
            const urlObj = new URL(e.request.url);
            const sourceTypeKey = `${e.request.method}:${urlObj.pathname}`;
            
            return {
                id: crypto.randomUUID(),
                source_type_key: sourceTypeKey,
                url: e.request.url,
                request: e.request,
                response: {
                    status: e.response.status,
                    content: { ...e.response.content, text: e.response.content.text?.substring(0, 1000) + '... (truncated for preview)' } // Keep full content in HAR, minimal in DB initial view
                },
                filterer_json: {},
                converter_code: '',
                final_clean_response: {},
                processing_status: ProcessingStatus.Unprocessed,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        });

        const updatedProject = {
            ...store.activeProject,
            scrapingEntries: [...(store.activeProject.scrapingEntries || []), ...newScrapingEntries],
            updatedAt: new Date().toISOString()
        };

        set({ activeProject: updatedProject });
        debouncedSave(updatedProject);
    },

    updateScrapingEntry: (id: string, updates: Partial<ScrapingEntry>) => {
        const store = get();
        if (!store.activeProject) return;

        const updatedEntries = (store.activeProject.scrapingEntries || []).map(e => 
            e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e
        );

        const updatedProject = {
            ...store.activeProject,
            scrapingEntries: updatedEntries,
            updatedAt: new Date().toISOString()
        };
        set({ activeProject: updatedProject });
        debouncedSave(updatedProject);
    },

    deleteScrapingEntry: (id: string) => {
        const store = get();
        if (!store.activeProject) return;

        const updatedEntries = (store.activeProject.scrapingEntries || []).filter(e => e.id !== id);

        const updatedProject = {
            ...store.activeProject,
            scrapingEntries: updatedEntries,
            updatedAt: new Date().toISOString()
        };
        set({ activeProject: updatedProject });
        debouncedSave(updatedProject);
    },

    setBackendUrl: (url: string) => {
        const store = get();
        if (!store.activeProject) return;
        const updatedProject = { ...store.activeProject, backendUrl: url };
        set({ activeProject: updatedProject });
        debouncedSave(updatedProject);
    },
    
    setNeo4jConfig: (config: Neo4jConfig) => {
        const store = get();
        if (!store.activeProject) return;
        const updatedProject = { ...store.activeProject, neo4jConfig: config };
        set({ activeProject: updatedProject });
        debouncedSave(updatedProject);
    },

    // --- Browser Session Actions ---

    createBrowserSession: (name: string) => {
        const store = get();
        if (!store.activeProject) return;
        
        const newSession: BrowserSession = {
            id: crypto.randomUUID(),
            name,
            createdAt: new Date().toISOString()
        };

        const updatedProject = {
            ...store.activeProject,
            browserSessions: [...(store.activeProject.browserSessions || []), newSession],
            updatedAt: new Date().toISOString()
        };
        set({ activeProject: updatedProject });
        debouncedSave(updatedProject);
    },

    deleteBrowserSession: (id: string) => {
        const store = get();
        if (!store.activeProject) return;

        const updatedSessions = (store.activeProject.browserSessions || []).filter(s => s.id !== id);
        // Ensure at least one session exists
        if (updatedSessions.length === 0) {
            updatedSessions.push({ id: crypto.randomUUID(), name: 'Default Session', createdAt: new Date().toISOString() });
        }

        const updatedProject = {
            ...store.activeProject,
            browserSessions: updatedSessions,
            updatedAt: new Date().toISOString()
        };
        set({ activeProject: updatedProject });
        debouncedSave(updatedProject);
    }
}));
