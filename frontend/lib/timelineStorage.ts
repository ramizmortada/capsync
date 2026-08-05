import { get, set, del } from 'idb-keyval';

export interface TimelineMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  mediaFileName?: string;
  mediaFileType?: string;
  duration?: number;
  segmentCount?: number;
}

export interface TimelineProjectData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  file: File | null;
  status: string;
  result: any;
  editableSegments: any[];
  rippleDeletes: any[];
  videoSegments: any[];
  videoCanvas: any;
  subtitleStyle?: any;
}

const INDEX_KEY = 'capsync_timelines_index';
const LEGACY_KEY = 'capsync_project';

// Get list of timeline metadata
export async function getAllTimelines(): Promise<TimelineMetadata[]> {
  try {
    await migrateLegacyProject();
    const index = await get<TimelineMetadata[]>(INDEX_KEY);
    return index ? index.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch (err) {
    console.error('Failed to get timelines index:', err);
    return [];
  }
}

// Get single timeline full data
export async function getTimeline(id: string): Promise<TimelineProjectData | null> {
  try {
    const data = await get<TimelineProjectData>(`capsync_timeline_${id}`);
    return data || null;
  } catch (err) {
    console.error(`Failed to get timeline ${id}:`, err);
    return null;
  }
}

// Save timeline data and update index
export async function saveTimeline(data: TimelineProjectData): Promise<void> {
  try {
    const now = Date.now();
    const updatedData: TimelineProjectData = {
      ...data,
      updatedAt: now,
    };

    // Save full data
    await set(`capsync_timeline_${data.id}`, updatedData);

    // Update index
    const index = (await get<TimelineMetadata[]>(INDEX_KEY)) || [];
    const meta: TimelineMetadata = {
      id: updatedData.id,
      name: updatedData.name,
      createdAt: updatedData.createdAt || now,
      updatedAt: now,
      mediaFileName: updatedData.file?.name,
      mediaFileType: updatedData.file?.type,
      duration: updatedData.videoSegments?.reduce((max, s) => s.deleted ? max : Math.max(max, s.timelineEnd), 0) || 0,
      segmentCount: updatedData.editableSegments?.length || 0,
    };

    const existingIndex = index.findIndex((t) => t.id === data.id);
    if (existingIndex !== -1) {
      index[existingIndex] = meta;
    } else {
      index.push(meta);
    }

    await set(INDEX_KEY, index);
  } catch (err) {
    console.error(`Failed to save timeline ${data.id}:`, err);
  }
}

// Create new blank or initial timeline
export async function createTimeline(
  name?: string,
  initialFile?: File | null
): Promise<TimelineProjectData> {
  const now = Date.now();
  const id = Math.random().toString(36).substring(2, 11);
  const timelineName = name || `Timeline ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const newTimeline: TimelineProjectData = {
    id,
    name: timelineName,
    createdAt: now,
    updatedAt: now,
    file: initialFile || null,
    status: 'idle',
    result: null,
    editableSegments: [],
    rippleDeletes: [],
    videoSegments: [],
    videoCanvas: { type: 'auto' },
  };

  await saveTimeline(newTimeline);
  return newTimeline;
}

// Duplicate existing timeline
export async function duplicateTimeline(id: string): Promise<TimelineProjectData | null> {
  const original = await getTimeline(id);
  if (!original) return null;

  const now = Date.now();
  const newId = Math.random().toString(36).substring(2, 11);
  const duplicated: TimelineProjectData = {
    ...JSON.parse(JSON.stringify(original)),
    id: newId,
    name: `${original.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
    file: original.file, // Keep file reference
  };

  await saveTimeline(duplicated);
  return duplicated;
}

// Rename timeline
export async function renameTimeline(id: string, newName: string): Promise<void> {
  const timeline = await getTimeline(id);
  if (!timeline) return;

  timeline.name = newName;
  await saveTimeline(timeline);
}

// Delete timeline
export async function deleteTimeline(id: string): Promise<void> {
  try {
    await del(`capsync_timeline_${id}`);
    const index = (await get<TimelineMetadata[]>(INDEX_KEY)) || [];
    const filtered = index.filter((t) => t.id !== id);
    await set(INDEX_KEY, filtered);
  } catch (err) {
    console.error(`Failed to delete timeline ${id}:`, err);
  }
}

// Auto-migrate single legacy project into multi-timeline index if present
export async function migrateLegacyProject(): Promise<void> {
  try {
    const legacy = await get<any>(LEGACY_KEY);
    if (!legacy) return;

    const index = (await get<TimelineMetadata[]>(INDEX_KEY)) || [];
    if (index.length === 0) {
      const now = Date.now();
      const id = 'default_legacy';
      const migrated: TimelineProjectData = {
        id,
        name: legacy.file?.name ? `Project - ${legacy.file.name}` : 'Main Timeline',
        createdAt: now,
        updatedAt: now,
        file: legacy.file || null,
        status: legacy.status || 'idle',
        result: legacy.result || null,
        editableSegments: legacy.editableSegments || [],
        rippleDeletes: legacy.rippleDeletes || [],
        videoSegments: legacy.videoSegments || [],
        videoCanvas: legacy.videoCanvas || { type: 'auto' },
      };

      await set(`capsync_timeline_${id}`, migrated);
      await set(INDEX_KEY, [
        {
          id,
          name: migrated.name,
          createdAt: now,
          updatedAt: now,
          mediaFileName: legacy.file?.name,
          mediaFileType: legacy.file?.type,
          duration: legacy.videoSegments?.reduce((max: number, s: any) => s.deleted ? max : Math.max(max, s.timelineEnd), 0) || 0,
          segmentCount: legacy.editableSegments?.length || 0,
        },
      ]);
    }

    // Clean up legacy key after migrating
    await del(LEGACY_KEY);
  } catch (err) {
    console.error('Failed to migrate legacy project:', err);
  }
}
