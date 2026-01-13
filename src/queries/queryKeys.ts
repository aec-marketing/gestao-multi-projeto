/**
 * Centralized Query Keys Factory
 *
 * Provides type-safe query keys for React Query
 * Prevents typos and makes cache invalidation easier
 */

export const queryKeys = {
  // Projects
  projects: {
    all: ['projects'] as const,
    detail: (id: string) => [...queryKeys.projects.all, id] as const
  },

  // Tasks
  tasks: {
    all: ['tasks'] as const,
    byProject: (projectId: string) => [...queryKeys.tasks.all, 'project', projectId] as const,
    detail: (id: string) => [...queryKeys.tasks.all, id] as const
  },

  // Resources
  resources: {
    all: ['resources'] as const,
    active: () => [...queryKeys.resources.all, 'active'] as const,
    detail: (id: string) => [...queryKeys.resources.all, id] as const
  },

  // Allocations
  allocations: {
    all: ['allocations'] as const,
    byProject: (projectId: string) => [...queryKeys.allocations.all, 'project', projectId] as const,
    byTask: (taskId: string) => [...queryKeys.allocations.all, 'task', taskId] as const
  },

  // Predecessors
  predecessors: {
    all: ['predecessors'] as const,
    byProject: (projectId: string) => [...queryKeys.predecessors.all, 'project', projectId] as const,
    byTask: (taskId: string) => [...queryKeys.predecessors.all, 'task', taskId] as const
  }
}
