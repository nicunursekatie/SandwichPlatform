import type { IStorage } from './storage';
import { MemStorage } from './storage';
import { GoogleSheetsStorage } from './google-sheets';
import { DatabaseStorage } from './database-storage';

class StorageWrapper implements IStorage {
  private primaryStorage: IStorage;
  private fallbackStorage: IStorage;
  private useGoogleSheets: boolean = false;
  private deletedIds: Set<number> = new Set(); // Track deleted items to prevent re-sync

  constructor() {
    this.fallbackStorage = new MemStorage();
    
    try {
      // Use database storage as primary for persistence across deployments
      this.primaryStorage = new DatabaseStorage();
      console.log('Database storage initialized');
    } catch (error) {
      console.log('Failed to initialize database storage, using memory storage');
      this.primaryStorage = this.fallbackStorage;
    }
  }

  private async syncDataFromGoogleSheets() {
    if (!this.useGoogleSheets) return;
    
    try {
      // Sync sandwich collections to memory storage
      const collections = await this.primaryStorage.getAllSandwichCollections();
      let syncedCount = 0;
      
      for (const collection of collections) {
        // Skip items that have been deleted
        if (this.deletedIds.has(collection.id)) {
          continue;
        }
        
        try {
          await this.fallbackStorage.createSandwichCollection(collection);
          syncedCount++;
        } catch (error) {
          // Ignore duplicates or other sync errors
        }
      }
      console.log(`Synchronized ${syncedCount} sandwich collections to memory storage`);
    } catch (error) {
      console.warn('Failed to sync data from Google Sheets:', error);
    }
  }

  private hasGoogleSheetsCredentials(): boolean {
    return !!(
      process.env.GOOGLE_SPREADSHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY
    );
  }

  private async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallbackOperation: () => Promise<T>
  ): Promise<T> {
    try {
      const result = await operation();
      // For delete operations that return false, use fallback
      if (typeof result === 'boolean' && result === false) {
        console.log('Primary storage operation returned false, using fallback storage');
        return fallbackOperation();
      }
      // For update operations that return undefined, use fallback
      if (result === undefined) {
        console.log('Primary storage operation returned undefined, using fallback storage');
        return fallbackOperation();
      }
      return result;
    } catch (error) {
      console.warn('Primary storage operation failed, using fallback:', error);
      return fallbackOperation();
    }
  }

  // User methods (required for authentication)
  async getUser(id: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.getUser(id),
      () => this.fallbackStorage.getUser(id)
    );
  }

  async getUserByEmail(email: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.getUserByEmail(email),
      () => this.fallbackStorage.getUserByEmail(email)
    );
  }

  async upsertUser(user: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.upsertUser(user),
      () => this.fallbackStorage.upsertUser(user)
    );
  }

  async getAllUsers() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllUsers(),
      () => this.fallbackStorage.getAllUsers()
    );
  }

  async updateUser(id: string, updates: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateUser(id, updates),
      () => this.fallbackStorage.updateUser(id, updates)
    );
  }

  async deleteUser(id: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteUser(id),
      () => this.fallbackStorage.deleteUser(id)
    );
  }

  // Legacy user methods (for backwards compatibility)
  async getUserByUsername(username: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.getUserByUsername(username),
      () => this.fallbackStorage.getUserByUsername(username)
    );
  }

  async createUser(user: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createUser(user),
      () => this.fallbackStorage.createUser(user)
    );
  }

  // Project methods
  async getAllProjects() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllProjects(),
      () => this.fallbackStorage.getAllProjects()
    );
  }

  async getProject(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getProject(id),
      () => this.fallbackStorage.getProject(id)
    );
  }

  async createProject(project: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createProject(project),
      () => this.fallbackStorage.createProject(project)
    );
  }

  async updateProject(id: number, updates: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateProject(id, updates),
      () => this.fallbackStorage.updateProject(id, updates)
    );
  }

  async deleteProject(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteProject(id),
      () => this.fallbackStorage.deleteProject(id)
    );
  }

  // Project Task methods
  async getProjectTasks(projectId: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getProjectTasks(projectId),
      () => this.fallbackStorage.getProjectTasks(projectId)
    );
  }

  async createProjectTask(task: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createProjectTask(task),
      () => this.fallbackStorage.createProjectTask(task)
    );
  }

  async updateProjectTask(id: number, updates: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateProjectTask(id, updates),
      () => this.fallbackStorage.updateProjectTask(id, updates)
    );
  }

  async deleteProjectTask(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteProjectTask(id),
      () => this.fallbackStorage.deleteProjectTask(id)
    );
  }

  async getTaskById(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getTaskById(id),
      () => this.fallbackStorage.getTaskById(id)
    );
  }

  async getProjectTask(taskId: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getProjectTask(taskId),
      () => this.fallbackStorage.getTaskById(taskId)
    );
  }

  async updateTaskStatus(id: number, status: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateTaskStatus(id, status),
      () => this.fallbackStorage.updateTaskStatus(id, status)
    );
  }

  // Task completion methods
  async createTaskCompletion(completion: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createTaskCompletion(completion),
      () => this.fallbackStorage.createTaskCompletion(completion)
    );
  }

  async getTaskCompletions(taskId: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getTaskCompletions(taskId),
      () => this.fallbackStorage.getTaskCompletions(taskId)
    );
  }

  async removeTaskCompletion(taskId: number, userId: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.removeTaskCompletion(taskId, userId),
      () => this.fallbackStorage.removeTaskCompletion(taskId, userId)
    );
  }

  // Project Comment methods
  async getProjectComments(projectId: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getProjectComments(projectId),
      () => this.fallbackStorage.getProjectComments(projectId)
    );
  }

  async createProjectComment(comment: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createProjectComment(comment),
      () => this.fallbackStorage.createProjectComment(comment)
    );
  }

  async deleteProjectComment(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteProjectComment(id),
      () => this.fallbackStorage.deleteProjectComment(id)
    );
  }

  // Message methods
  async getAllMessages() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllMessages(),
      () => this.fallbackStorage.getAllMessages()
    );
  }

  async getRecentMessages(limit: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getRecentMessages(limit),
      () => this.fallbackStorage.getRecentMessages(limit)
    );
  }

  async getMessagesByCommittee(committee: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.getMessagesByCommittee(committee),
      () => this.fallbackStorage.getMessagesByCommittee(committee)
    );
  }

  async getDirectMessages(userId1: string, userId2: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.getDirectMessages(userId1, userId2),
      () => this.fallbackStorage.getDirectMessages(userId1, userId2)
    );
  }

  async getMessageById(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getMessageById(id),
      () => this.fallbackStorage.getMessageById(id)
    );
  }

  async createMessage(message: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createMessage(message),
      () => this.fallbackStorage.createMessage(message)
    );
  }

  async getThreadMessages(threadId: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getThreadMessages(threadId),
      () => this.fallbackStorage.getThreadMessages(threadId)
    );
  }

  async createReply(message: any, parentId: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.createReply(message, parentId),
      () => this.fallbackStorage.createReply(message, parentId)
    );
  }

  async updateReplyCount(messageId: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateReplyCount(messageId),
      () => this.fallbackStorage.updateReplyCount(messageId)
    );
  }

  async deleteMessage(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteMessage(id),
      () => this.fallbackStorage.deleteMessage(id)
    );
  }

  // Weekly Reports methods
  async getAllWeeklyReports() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllWeeklyReports(),
      () => this.fallbackStorage.getAllWeeklyReports()
    );
  }

  async createWeeklyReport(report: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createWeeklyReport(report),
      () => this.fallbackStorage.createWeeklyReport(report)
    );
  }

  // Sandwich Collections methods
  async getAllSandwichCollections() {
    const collections = await this.executeWithFallback(
      () => this.primaryStorage.getAllSandwichCollections(),
      () => this.fallbackStorage.getAllSandwichCollections()
    );
    
    // Filter out deleted items
    return collections.filter(collection => !this.deletedIds.has(collection.id));
  }

  async getSandwichCollections(limit: number, offset: number) {
    return await this.executeWithFallback(
      () => this.primaryStorage.getSandwichCollections(limit, offset),
      async () => {
        // Fallback: get all and slice manually
        const all = await this.fallbackStorage.getAllSandwichCollections();
        return all.slice(offset, offset + limit);
      }
    );
  }

  async getSandwichCollectionsCount() {
    const result = await this.executeWithFallback(
      () => this.primaryStorage.getSandwichCollectionsCount(),
      async () => {
        // Fallback: get all and count
        const all = await this.fallbackStorage.getAllSandwichCollections();
        return all.length;
      }
    );
    return Number(result);
  }

  async getCollectionStats() {
    return this.executeWithFallback(
      () => this.primaryStorage.getCollectionStats(),
      async () => {
        // Fallback: calculate stats from all collections
        const all = await this.fallbackStorage.getAllSandwichCollections();
        const totalSandwiches = all.reduce((sum, collection) => sum + (collection.individualSandwiches || 0), 0);
        return {
          totalEntries: all.length,
          totalSandwiches
        };
      }
    );
  }

  async createSandwichCollection(collection: any) {
    return this.executeWithFallback(
      async () => {
        const result = await this.primaryStorage.createSandwichCollection(collection);
        // Also create in fallback storage to keep them synchronized
        try {
          await this.fallbackStorage.createSandwichCollection({...collection, id: result.id});
        } catch (error) {
          console.warn('Failed to sync collection to fallback storage:', error);
        }
        return result;
      },
      () => this.fallbackStorage.createSandwichCollection(collection)
    );
  }

  async updateSandwichCollection(id: number, updates: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateSandwichCollection(id, updates),
      () => this.fallbackStorage.updateSandwichCollection(id, updates)
    );
  }

  async deleteSandwichCollection(id: number) {
    // Track the deleted ID to prevent re-sync
    this.deletedIds.add(id);
    
    try {
      // Use only database storage for faster deletes
      const result = await this.primaryStorage.deleteSandwichCollection(id);
      
      // If deletion fails, remove from tracking
      if (!result) {
        this.deletedIds.delete(id);
      }
      
      return result;
    } catch (error) {
      // If database fails, remove from tracking and fallback
      this.deletedIds.delete(id);
      console.warn('Database delete failed, trying fallback storage:', error);
      return this.fallbackStorage.deleteSandwichCollection(id);
    }
  }

  // Meeting Minutes methods
  async getAllMeetingMinutes() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllMeetingMinutes(),
      () => this.fallbackStorage.getAllMeetingMinutes()
    );
  }

  async getRecentMeetingMinutes(limit: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getRecentMeetingMinutes(limit),
      () => this.fallbackStorage.getRecentMeetingMinutes(limit)
    );
  }

  async createMeetingMinutes(minutes: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createMeetingMinutes(minutes),
      () => this.fallbackStorage.createMeetingMinutes(minutes)
    );
  }

  async deleteMeetingMinutes(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteMeetingMinutes(id),
      () => this.fallbackStorage.deleteMeetingMinutes(id)
    );
  }

  // Drive Links methods
  async getAllDriveLinks() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllDriveLinks(),
      () => this.fallbackStorage.getAllDriveLinks()
    );
  }

  async createDriveLink(link: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createDriveLink(link),
      () => this.fallbackStorage.createDriveLink(link)
    );
  }

  async getAllAgendaItems() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllAgendaItems(),
      () => this.fallbackStorage.getAllAgendaItems()
    );
  }

  async createAgendaItem(item: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createAgendaItem(item),
      () => this.fallbackStorage.createAgendaItem(item)
    );
  }

  async updateAgendaItemStatus(id: number, status: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateAgendaItemStatus(id, status),
      () => this.fallbackStorage.updateAgendaItemStatus(id, status)
    );
  }

  async updateAgendaItem(id: number, updates: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateAgendaItem(id, updates),
      () => this.fallbackStorage.updateAgendaItem(id, updates)
    );
  }

  async deleteAgendaItem(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteAgendaItem(id),
      () => this.fallbackStorage.deleteAgendaItem(id)
    );
  }

  async getCurrentMeeting() {
    return this.executeWithFallback(
      () => this.primaryStorage.getCurrentMeeting(),
      () => this.fallbackStorage.getCurrentMeeting()
    );
  }

  async getAllMeetings() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllMeetings(),
      () => this.fallbackStorage.getAllMeetings()
    );
  }

  async getMeetingsByType(type: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.getMeetingsByType(type),
      () => this.fallbackStorage.getMeetingsByType(type)
    );
  }

  async createMeeting(meeting: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createMeeting(meeting),
      () => this.fallbackStorage.createMeeting(meeting)
    );
  }

  async updateMeetingAgenda(id: number, agenda: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateMeetingAgenda(id, agenda),
      () => this.fallbackStorage.updateMeetingAgenda(id, agenda)
    );
  }

  async updateMeeting(id: number, updates: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateMeeting(id, updates),
      () => this.fallbackStorage.updateMeeting(id, updates)
    );
  }

  async deleteMeeting(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteMeeting(id),
      () => this.fallbackStorage.deleteMeeting(id)
    );
  }

  async createDriverAgreement(agreement: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createDriverAgreement(agreement),
      () => this.fallbackStorage.createDriverAgreement(agreement)
    );
  }

  // Host methods
  async getAllHosts() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllHosts(),
      () => this.fallbackStorage.getAllHosts()
    );
  }

  async getAllHostsWithContacts() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllHostsWithContacts(),
      () => this.fallbackStorage.getAllHostsWithContacts()
    );
  }

  async getHost(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getHost(id),
      () => this.fallbackStorage.getHost(id)
    );
  }

  async createHost(host: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createHost(host),
      () => this.fallbackStorage.createHost(host)
    );
  }

  async updateHost(id: number, updates: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateHost(id, updates),
      () => this.fallbackStorage.updateHost(id, updates)
    );
  }

  async deleteHost(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteHost(id),
      () => this.fallbackStorage.deleteHost(id)
    );
  }

  // Recipients methods
  async getAllRecipients() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllRecipients(),
      () => this.fallbackStorage.getAllRecipients()
    );
  }

  async getRecipient(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getRecipient(id),
      () => this.fallbackStorage.getRecipient(id)
    );
  }

  async createRecipient(recipient: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createRecipient(recipient),
      () => this.fallbackStorage.createRecipient(recipient)
    );
  }

  async updateRecipient(id: number, updates: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateRecipient(id, updates),
      () => this.fallbackStorage.updateRecipient(id, updates)
    );
  }

  async deleteRecipient(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteRecipient(id),
      () => this.fallbackStorage.deleteRecipient(id)
    );
  }

  async updateCollectionHostNames(oldHostName: string, newHostName: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateCollectionHostNames(oldHostName, newHostName),
      () => this.fallbackStorage.updateCollectionHostNames(oldHostName, newHostName)
    );
  }

  // General Contacts methods
  async getAllContacts() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllContacts(),
      () => this.fallbackStorage.getAllContacts()
    );
  }

  async getContact(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getContact(id),
      () => this.fallbackStorage.getContact(id)
    );
  }

  async createContact(contact: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createContact(contact),
      () => this.fallbackStorage.createContact(contact)
    );
  }

  async updateContact(id: number, updates: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateContact(id, updates),
      () => this.fallbackStorage.updateContact(id, updates)
    );
  }

  async deleteContact(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteContact(id),
      () => this.fallbackStorage.deleteContact(id)
    );
  }

  // Host Contacts methods
  async createHostContact(contact: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createHostContact(contact),
      () => this.fallbackStorage.createHostContact(contact)
    );
  }

  async getHostContacts(hostId: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getHostContacts(hostId),
      () => this.fallbackStorage.getHostContacts(hostId)
    );
  }

  async updateHostContact(id: number, updates: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateHostContact(id, updates),
      () => this.fallbackStorage.updateHostContact(id, updates)
    );
  }

  async deleteHostContact(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteHostContact(id),
      () => this.fallbackStorage.deleteHostContact(id)
    );
  }

  // Driver methods
  async getAllDrivers() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllDrivers(),
      () => this.fallbackStorage.getAllDrivers()
    );
  }

  async getDriver(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getDriver(id),
      () => this.fallbackStorage.getDriver(id)
    );
  }

  async createDriver(driver: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createDriver(driver),
      () => this.fallbackStorage.createDriver(driver)
    );
  }

  async updateDriver(id: number, updates: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateDriver(id, updates),
      () => {
        throw new Error("Driver operations not available in fallback storage");
      }
    );
  }

  async deleteDriver(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteDriver(id),
      () => this.fallbackStorage.deleteDriver(id)
    );
  }

  // Committee management methods
  async getAllCommittees() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllCommittees(),
      () => this.fallbackStorage.getAllCommittees()
    );
  }

  async getCommittee(id: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.getCommittee(id),
      () => this.fallbackStorage.getCommittee(id)
    );
  }

  async createCommittee(committee: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createCommittee(committee),
      () => this.fallbackStorage.createCommittee(committee)
    );
  }

  async updateCommittee(id: string, updates: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateCommittee(id, updates),
      () => this.fallbackStorage.updateCommittee(id, updates)
    );
  }

  async deleteCommittee(id: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteCommittee(id),
      () => this.fallbackStorage.deleteCommittee(id)
    );
  }

  async getUserCommittees(userId: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.getUserCommittees(userId),
      () => this.fallbackStorage.getUserCommittees(userId)
    );
  }

  async getCommitteeMembers(committeeId: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.getCommitteeMembers(committeeId),
      () => this.fallbackStorage.getCommitteeMembers(committeeId)
    );
  }

  async addUserToCommittee(membership: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.addUserToCommittee(membership),
      () => this.fallbackStorage.addUserToCommittee(membership)
    );
  }

  async updateCommitteeMembership(id: number, updates: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateCommitteeMembership(id, updates),
      () => this.fallbackStorage.updateCommitteeMembership(id, updates)
    );
  }

  async removeUserFromCommittee(userId: string, committeeId: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.removeUserFromCommittee(userId, committeeId),
      () => this.fallbackStorage.removeUserFromCommittee(userId, committeeId)
    );
  }

  async isUserCommitteeMember(userId: string, committeeId: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.isUserCommitteeMember(userId, committeeId),
      () => this.fallbackStorage.isUserCommitteeMember(userId, committeeId)
    );
  }

  // Announcement methods
  async getAllAnnouncements() {
    return this.executeWithFallback(
      () => this.primaryStorage.getAllAnnouncements(),
      () => this.fallbackStorage.getAllAnnouncements()
    );
  }

  async createAnnouncement(announcement: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.createAnnouncement(announcement),
      () => this.fallbackStorage.createAnnouncement(announcement)
    );
  }

  async updateAnnouncement(id: number, updates: any) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateAnnouncement(id, updates),
      () => this.fallbackStorage.updateAnnouncement(id, updates)
    );
  }

  async deleteAnnouncement(id: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.deleteAnnouncement(id),
      () => this.fallbackStorage.deleteAnnouncement(id)
    );
  }

  // Project assignments
  async getProjectAssignments(projectId: number) {
    return this.executeWithFallback(
      () => this.primaryStorage.getProjectAssignments(projectId),
      () => this.fallbackStorage.getProjectAssignments(projectId)
    );
  }

  async addProjectAssignment(assignment: { projectId: number; userId: string; role: string }) {
    return this.executeWithFallback(
      () => this.primaryStorage.addProjectAssignment(assignment),
      () => this.fallbackStorage.addProjectAssignment(assignment)
    );
  }

  async removeProjectAssignment(projectId: number, userId: string) {
    return this.executeWithFallback(
      () => this.primaryStorage.removeProjectAssignment(projectId, userId),
      () => this.fallbackStorage.removeProjectAssignment(projectId, userId)
    );
  }

  async updateProjectAssignment(projectId: number, userId: string, updates: { role: string }) {
    return this.executeWithFallback(
      () => this.primaryStorage.updateProjectAssignment(projectId, userId, updates),
      () => this.fallbackStorage.updateProjectAssignment(projectId, userId, updates)
    );
  }
}

export const storage = new StorageWrapper();