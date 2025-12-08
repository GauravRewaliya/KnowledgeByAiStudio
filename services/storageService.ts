
import { openDB, IDBPDatabase } from 'idb';
import { ProjectMetadata, ProjectData } from '../types';

const DB_NAME = 'HarMindDB';
const DB_VERSION = 2; // Upgraded version
const STORE_METADATA = 'metadata';
const STORE_PROJECTS = 'projects';

class StorageService {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        // Store for metadata (lightweight list)
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA, { keyPath: 'id' });
        }
        // Store for full project data (heavy blobs)
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        }
        
        // Version 2 migration logic if needed (currently storing scrapingEntries inside ProjectData blob)
        // If we wanted scrapingEntries to be independent, we would create a separate store.
        // For simplicity and atomic backups, we keep it inside ProjectData for now.
      },
    });
  }

  async getAllMetadata(): Promise<ProjectMetadata[]> {
    const db = await this.dbPromise;
    return db.getAll(STORE_METADATA);
  }

  async getProject(id: string): Promise<ProjectData | undefined> {
    const db = await this.dbPromise;
    return db.get(STORE_PROJECTS, id);
  }

  async saveProject(project: ProjectData): Promise<void> {
    const db = await this.dbPromise;
    const { harEntries, knowledgeData, chatHistory, scrapingEntries, ...metadata } = project;
    
    // Calculate approximate size
    const size = JSON.stringify(project).length;
    const enrichedMetadata: ProjectMetadata = {
      ...metadata,
      requestCount: harEntries.length,
      entityCount: knowledgeData.nodes.length,
      updatedAt: new Date().toISOString(),
      size
    };

    const tx = db.transaction([STORE_METADATA, STORE_PROJECTS], 'readwrite');
    await Promise.all([
      tx.objectStore(STORE_METADATA).put(enrichedMetadata),
      tx.objectStore(STORE_PROJECTS).put({ ...project, ...enrichedMetadata })
    ]);
    await tx.done;
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction([STORE_METADATA, STORE_PROJECTS], 'readwrite');
    await Promise.all([
      tx.objectStore(STORE_METADATA).delete(id),
      tx.objectStore(STORE_PROJECTS).delete(id)
    ]);
    await tx.done;
  }
}

export const storageService = new StorageService();
