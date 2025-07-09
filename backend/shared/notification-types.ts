export const NotificationTypes = {
  PROJECT_ASSIGNED: 'project_assigned',
  PROJECT_UPDATED: 'project_updated', 
  TASK_ADDED: 'task_added',
  TASK_ASSIGNED: 'task_assigned',
  PROJECT_STATUS_CHANGED: 'project_status_changed',
  PROJECT_DUE_REMINDER: 'project_due_reminder'
} as const;

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes];

export interface ProjectNotificationData {
  projectId: number;
  projectTitle: string;
  assignedBy?: string;
  assignedTo?: string[];
  oldStatus?: string;
  newStatus?: string;
  taskTitle?: string;
  dueDate?: string;
}

export interface EmailNotificationTemplate {
  subject: string;
  body: string;
  recipients: string[];
}