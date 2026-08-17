import { get, set, del } from 'idb-keyval';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  description?: string;
}

export interface TimelineMetadata {
  id: string;
  projectId?: string | null;
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
  projectId?: string | null;
  name: string;
  createdAt: number;
  updatedAt: number;
  file: File | null;
  status: string;
  result: any;
  editableSegments: any[];
  rippleDeletes: any[];
  videoSegments: any[];
  audioSegments?: any[];
  videoCanvas: any;
  subtitleStyle?: any;
}

const INDEX_KEY = 'capsync_timelines_index';
const PROJECTS_INDEX_KEY = 'capsync_projects_index';
const LEGACY_KEY = 'capsync_project';

// --- PROJECT HELPERS ---

export async function getAllProjects(): Promise<Project[]> {
  try {
    const projects = await get<Project[]>(PROJECTS_INDEX_KEY);
    return projects ? projects.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch (err) {
    console.error('Failed to get projects index:', err);
    return [];
  }
}

export async function createProject(name?: string): Promise<Project> {
  const now = Date.now();
  const id = Math.random().toString(36).substring(2, 11);
  const projectName = name || `Project ${new Date().toLocaleDateString()}`;

  const newProject: Project = {
    id,
    name: projectName,
    createdAt: now,
    updatedAt: now,
  };

  const projects = (await get<Project[]>(PROJECTS_INDEX_KEY)) || [];
  projects.push(newProject);
  await set(PROJECTS_INDEX_KEY, projects);

  return newProject;
}

export async function renameProject(id: string, newName: string): Promise<void> {
  const projects = (await get<Project[]>(PROJECTS_INDEX_KEY)) || [];
  const project = projects.find(p => p.id === id);
  if (project) {
    project.name = newName;
    project.updatedAt = Date.now();
    await set(PROJECTS_INDEX_KEY, projects);
  }
}

export async function deleteProject(id: string, deleteTimelines: boolean = false): Promise<void> {
  try {
    const projects = (await get<Project[]>(PROJECTS_INDEX_KEY)) || [];
    const filteredProjects = projects.filter(p => p.id !== id);
    await set(PROJECTS_INDEX_KEY, filteredProjects);

    const index = (await get<TimelineMetadata[]>(INDEX_KEY)) || [];
    if (deleteTimelines) {
      // Delete all timelines in this project
      const timelinesToDelete = index.filter(t => t.projectId === id);
      for (const t of timelinesToDelete) {
        await del(`capsync_timeline_${t.id}`);
      }
      const remainingIndex = index.filter(t => t.projectId !== id);
      await set(INDEX_KEY, remainingIndex);
    } else {
      // Unassign timelines from this project
      const updatedIndex = index.map(t => t.projectId === id ? { ...t, projectId: null } : t);
      await set(INDEX_KEY, updatedIndex);

      for (const t of index) {
        if (t.projectId === id) {
          const fullData = await getTimeline(t.id);
          if (fullData) {
            fullData.projectId = null;
            await set(`capsync_timeline_${t.id}`, fullData);
          }
        }
      }
    }
  } catch (err) {
    console.error(`Failed to delete project ${id}:`, err);
  }
}

export async function assignTimelineToProject(timelineId: string, projectId: string | null): Promise<void> {
  const timeline = await getTimeline(timelineId);
  if (timeline) {
    timeline.projectId = projectId;
    await saveTimeline(timeline);
  }
}

// --- TIMELINE HELPERS ---

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

export async function getTimeline(id: string): Promise<TimelineProjectData | null> {
  try {
    const data = await get<TimelineProjectData>(`capsync_timeline_${id}`);
    return data || null;
  } catch (err) {
    console.error(`Failed to get timeline ${id}:`, err);
    return null;
  }
}

export async function saveTimeline(data: TimelineProjectData): Promise<void> {
  try {
    const now = Date.now();
    const updatedData: TimelineProjectData = {
      ...data,
      updatedAt: now,
    };

    await set(`capsync_timeline_${data.id}`, updatedData);

    const index = (await get<TimelineMetadata[]>(INDEX_KEY)) || [];
    const meta: TimelineMetadata = {
      id: updatedData.id,
      projectId: updatedData.projectId || null,
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

    // Update parent project's updatedAt timestamp
    if (updatedData.projectId) {
      const projects = (await get<Project[]>(PROJECTS_INDEX_KEY)) || [];
      const project = projects.find((p) => p.id === updatedData.projectId);
      if (project) {
        project.updatedAt = now;
        await set(PROJECTS_INDEX_KEY, projects);
      }
    }
  } catch (err) {
    console.error(`Failed to save timeline ${data.id}:`, err);
  }
}

export async function createTimeline(
  name?: string,
  projectId?: string | null,
  initialFile?: File | null
): Promise<TimelineProjectData> {
  const now = Date.now();
  const id = Math.random().toString(36).substring(2, 11);
  const timelineName = name || `Timeline ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const newTimeline: TimelineProjectData = {
    id,
    projectId: projectId || null,
    name: timelineName,
    createdAt: now,
    updatedAt: now,
    file: initialFile || null,
    status: 'idle',
    result: null,
    editableSegments: [],
    rippleDeletes: [],
    videoSegments: [],
    audioSegments: [],
    videoCanvas: { type: 'auto' },
  };

  await saveTimeline(newTimeline);
  return newTimeline;
}

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
    file: original.file,
  };

  await saveTimeline(duplicated);
  return duplicated;
}

export async function renameTimeline(id: string, newName: string): Promise<void> {
  const timeline = await getTimeline(id);
  if (!timeline) return;

  timeline.name = newName;
  await saveTimeline(timeline);
}

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

    await del(LEGACY_KEY);
  } catch (err) {
    console.error('Failed to migrate legacy project:', err);
  }
}
