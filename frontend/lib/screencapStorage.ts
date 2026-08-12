import { get, set, del } from 'idb-keyval';
import { StagedFrameItem, CanvasComposition } from '@/app/types/imageEditor';
import { SubtitleStyle } from '@/app/types';

export interface ScreencapMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  mediaFileName?: string;
  stagedItemCount?: number;
  canvasCount?: number;
}

export interface ScreencapProjectData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  file: File | Blob | null;
  stagedItems: StagedFrameItem[];
  canvases: CanvasComposition[];
  subtitleStyle?: SubtitleStyle;
}

const SCREENCAP_INDEX_KEY = 'capsync_screencaps_index';

export async function getAllScreencaps(): Promise<ScreencapMetadata[]> {
  try {
    const index = await get<ScreencapMetadata[]>(SCREENCAP_INDEX_KEY);
    return index ? index.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch (err) {
    console.error('Failed to get screencaps index:', err);
    return [];
  }
}

export async function getScreencapProject(id: string): Promise<ScreencapProjectData | null> {
  try {
    const data = await get<ScreencapProjectData>(`capsync_screencap_${id}`);
    return data || null;
  } catch (err) {
    console.error(`Failed to get screencap project ${id}:`, err);
    return null;
  }
}

export async function saveScreencapProject(project: ScreencapProjectData): Promise<void> {
  try {
    project.updatedAt = Date.now();
    await set(`capsync_screencap_${project.id}`, project);
    
    // Update index
    const index = (await get<ScreencapMetadata[]>(SCREENCAP_INDEX_KEY)) || [];
    const metadata: ScreencapMetadata = {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      mediaFileName: project.file instanceof File ? project.file.name : undefined,
      stagedItemCount: project.stagedItems?.length || 0,
      canvasCount: project.canvases?.length || 0,
    };

    const existingIndex = index.findIndex(m => m.id === project.id);
    if (existingIndex >= 0) {
      index[existingIndex] = metadata;
    } else {
      index.push(metadata);
    }

    await set(SCREENCAP_INDEX_KEY, index);
  } catch (err) {
    console.error(`Failed to save screencap project ${project.id}:`, err);
    throw err;
  }
}

export async function deleteScreencapProject(id: string): Promise<void> {
  try {
    await del(`capsync_screencap_${id}`);
    
    const index = (await get<ScreencapMetadata[]>(SCREENCAP_INDEX_KEY)) || [];
    const newIndex = index.filter(m => m.id !== id);
    await set(SCREENCAP_INDEX_KEY, newIndex);
  } catch (err) {
    console.error(`Failed to delete screencap project ${id}:`, err);
    throw err;
  }
}

export async function createScreencapProject(
  name: string,
  file: File | Blob | null = null,
  stagedItems: StagedFrameItem[] = [],
  canvases: CanvasComposition[] = [],
  subtitleStyle?: SubtitleStyle
): Promise<ScreencapProjectData> {
  const now = Date.now();
  const id = `screencap_${Math.random().toString(36).substring(2, 11)}`;
  
  const newProject: ScreencapProjectData = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    file,
    stagedItems,
    canvases,
    subtitleStyle
  };

  await saveScreencapProject(newProject);
  return newProject;
}
