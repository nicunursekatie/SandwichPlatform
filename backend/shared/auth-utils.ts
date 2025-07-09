export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  COMMITTEE_MEMBER: 'committee_member',
  HOST: 'host',
  DRIVER: 'driver',
  VOLUNTEER: 'volunteer',
  RECIPIENT: 'recipient',
  VIEWER: 'viewer',
  WORK_LOGGER: 'work_logger'
} as const;

export const PERMISSIONS = {
  // Management permissions
  MANAGE_USERS: 'manage_users',
  MANAGE_HOSTS: 'manage_hosts',
  MANAGE_RECIPIENTS: 'manage_recipients',
  MANAGE_DRIVERS: 'manage_drivers',
  MANAGE_COLLECTIONS: 'manage_collections',
  MANAGE_ANNOUNCEMENTS: 'manage_announcements',
  MANAGE_COMMITTEES: 'manage_committees',
  MANAGE_PROJECTS: 'manage_projects',
  
  // View permissions
  VIEW_PHONE_DIRECTORY: 'view_phone_directory',
  VIEW_HOSTS: 'view_hosts',
  VIEW_RECIPIENTS: 'view_recipients',
  VIEW_DRIVERS: 'view_drivers',
  VIEW_COMMITTEE: 'view_committee',
  VIEW_USERS: 'view_users',
  VIEW_COLLECTIONS: 'view_collections',
  VIEW_REPORTS: 'view_reports',
  VIEW_MEETINGS: 'view_meetings',
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_PROJECTS: 'view_projects',
  VIEW_ROLE_DEMO: 'view_role_demo',
  
  // Edit permissions
  EDIT_COLLECTIONS: 'edit_data',
  EDIT_MEETINGS: 'edit_meetings',
  DELETE_COLLECTIONS: 'delete_data',
  SCHEDULE_REPORTS: 'schedule_reports',
  
  // Chat permissions
  GENERAL_CHAT: 'general_chat',
  COMMITTEE_CHAT: 'committee_chat',
  HOST_CHAT: 'host_chat',
  DRIVER_CHAT: 'driver_chat',
  RECIPIENT_CHAT: 'recipient_chat',
  CORE_TEAM_CHAT: 'core_team_chat',
  DIRECT_MESSAGES: 'direct_messages',
  GROUP_MESSAGES: 'group_messages',
  SEND_MESSAGES: 'send_messages',
  MODERATE_MESSAGES: 'moderate_messages',
  EXPORT_DATA: 'export_data',
  IMPORT_DATA: 'import_data',
  
  // Toolkit access
  TOOLKIT_ACCESS: 'toolkit_access'
} as const;

export function getDefaultPermissionsForRole(role: string): string[] {
  switch (role) {
    case USER_ROLES.SUPER_ADMIN:
      return Object.values(PERMISSIONS);
      
    case USER_ROLES.ADMIN:
      return Object.values(PERMISSIONS).filter(p => p !== PERMISSIONS.MODERATE_MESSAGES);
    
    case USER_ROLES.COMMITTEE_MEMBER:
      return [
        PERMISSIONS.VIEW_PHONE_DIRECTORY,
        PERMISSIONS.VIEW_HOSTS,
        PERMISSIONS.VIEW_RECIPIENTS,
        PERMISSIONS.VIEW_DRIVERS,
        PERMISSIONS.VIEW_COMMITTEE,
        PERMISSIONS.GENERAL_CHAT,
        PERMISSIONS.COMMITTEE_CHAT,
        PERMISSIONS.DIRECT_MESSAGES,
        PERMISSIONS.GROUP_MESSAGES,
        PERMISSIONS.TOOLKIT_ACCESS,
        PERMISSIONS.VIEW_COLLECTIONS,
        PERMISSIONS.VIEW_REPORTS,
        PERMISSIONS.VIEW_MEETINGS,
        PERMISSIONS.VIEW_ANALYTICS,
        PERMISSIONS.VIEW_ROLE_DEMO,
        PERMISSIONS.SEND_MESSAGES
      ];
    
    case USER_ROLES.HOST:
      return [
        PERMISSIONS.VIEW_PHONE_DIRECTORY,
        PERMISSIONS.GENERAL_CHAT,
        PERMISSIONS.HOST_CHAT,
        PERMISSIONS.DIRECT_MESSAGES,
        PERMISSIONS.GROUP_MESSAGES,
        PERMISSIONS.TOOLKIT_ACCESS,
        PERMISSIONS.VIEW_COLLECTIONS,
        PERMISSIONS.VIEW_REPORTS,
        PERMISSIONS.VIEW_PROJECTS,
        PERMISSIONS.SEND_MESSAGES
      ];
    
    case USER_ROLES.DRIVER:
      return [
        PERMISSIONS.VIEW_PHONE_DIRECTORY,
        PERMISSIONS.GENERAL_CHAT,
        PERMISSIONS.DRIVER_CHAT,
        PERMISSIONS.DIRECT_MESSAGES,
        PERMISSIONS.GROUP_MESSAGES,
        PERMISSIONS.TOOLKIT_ACCESS,
        PERMISSIONS.VIEW_COLLECTIONS,
        PERMISSIONS.VIEW_REPORTS,
        PERMISSIONS.VIEW_PROJECTS,
        PERMISSIONS.SEND_MESSAGES
      ];
    
    case USER_ROLES.VOLUNTEER:
      return [
        PERMISSIONS.VIEW_PHONE_DIRECTORY,  // Need this for navigation access
        PERMISSIONS.GENERAL_CHAT,
        PERMISSIONS.DIRECT_MESSAGES,
        PERMISSIONS.GROUP_MESSAGES,
        PERMISSIONS.TOOLKIT_ACCESS,
        PERMISSIONS.VIEW_COLLECTIONS,
        PERMISSIONS.VIEW_REPORTS,
        PERMISSIONS.VIEW_PROJECTS,
        PERMISSIONS.EDIT_COLLECTIONS,  // For development tab access
        PERMISSIONS.SEND_MESSAGES
      ];
    
    case USER_ROLES.RECIPIENT:
      return [
        PERMISSIONS.GENERAL_CHAT,
        PERMISSIONS.RECIPIENT_CHAT,
        PERMISSIONS.DIRECT_MESSAGES,
        PERMISSIONS.GROUP_MESSAGES,
        PERMISSIONS.VIEW_COLLECTIONS,
        PERMISSIONS.SEND_MESSAGES
      ];
    
    case USER_ROLES.VIEWER:
      return [
        PERMISSIONS.VIEW_PHONE_DIRECTORY,
        PERMISSIONS.DIRECT_MESSAGES,
        PERMISSIONS.GROUP_MESSAGES,
        PERMISSIONS.TOOLKIT_ACCESS,
        PERMISSIONS.VIEW_COLLECTIONS,
        PERMISSIONS.VIEW_REPORTS,
        PERMISSIONS.VIEW_PROJECTS,
        PERMISSIONS.SEND_MESSAGES
      ];
    
    case USER_ROLES.WORK_LOGGER:
      return [
        PERMISSIONS.VIEW_PHONE_DIRECTORY,
        PERMISSIONS.GENERAL_CHAT,
        PERMISSIONS.DIRECT_MESSAGES,
        PERMISSIONS.GROUP_MESSAGES,
        PERMISSIONS.TOOLKIT_ACCESS,
        PERMISSIONS.VIEW_COLLECTIONS,
        PERMISSIONS.VIEW_REPORTS,
        PERMISSIONS.VIEW_PROJECTS,
        PERMISSIONS.SEND_MESSAGES,
        'log_work' // Custom permission for work logging
      ];
    
    default:
      return [];
  }
}

// Chat room to permission mapping
export const CHAT_PERMISSIONS = {
  'general': PERMISSIONS.GENERAL_CHAT,
  'committee': PERMISSIONS.COMMITTEE_CHAT,
  'hosts': PERMISSIONS.HOST_CHAT,
  'drivers': PERMISSIONS.DRIVER_CHAT,
  'recipients': PERMISSIONS.RECIPIENT_CHAT,
  'core_team': PERMISSIONS.CORE_TEAM_CHAT,
  'direct': PERMISSIONS.DIRECT_MESSAGES,
  'groups': PERMISSIONS.GROUP_MESSAGES
} as const;

// Function to check if user has access to a specific chat room
export function hasAccessToChat(user: any, chatRoom: string): boolean {
  if (!user || !user.permissions) return false;
  
  const requiredPermission = CHAT_PERMISSIONS[chatRoom as keyof typeof CHAT_PERMISSIONS];
  if (!requiredPermission) return false;
  
  return user.permissions.includes(requiredPermission);
}

// Function to check if user has a specific permission
export function hasPermission(user: any, permission: string): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.includes(permission);
}

// Function to get human-readable role display name
export function getRoleDisplayName(role: string): string {
  switch (role) {
    case USER_ROLES.SUPER_ADMIN:
      return 'Super Administrator';
    case USER_ROLES.ADMIN:
      return 'Administrator';
    case USER_ROLES.COMMITTEE_MEMBER:
      return 'Committee Member';
    case USER_ROLES.HOST:
      return 'Host Organization';
    case USER_ROLES.DRIVER:
      return 'Delivery Driver';
    case USER_ROLES.VOLUNTEER:
      return 'Volunteer';
    case USER_ROLES.RECIPIENT:
      return 'Recipient Organization';
    case USER_ROLES.VIEWER:
      return 'Viewer';
    case USER_ROLES.WORK_LOGGER:
      return 'Work Logger';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ');
  }
}