import { 
  users, projects, projectTasks, projectComments, projectAssignments, taskCompletions, messages, conversations, conversationParticipants, weeklyReports, meetingMinutes, driveLinks, sandwichCollections, agendaItems, meetings, driverAgreements, drivers, hosts, hostContacts, recipients, contacts, committees, committeeMemberships, notifications,
  type User, type InsertUser, type UpsertUser,
  type Project, type InsertProject,
  type ProjectTask, type InsertProjectTask,
  type ProjectComment, type InsertProjectComment,
  type ProjectAssignment, type InsertProjectAssignment,
  type TaskCompletion, type InsertTaskCompletion,
  type Message, type InsertMessage,
  type WeeklyReport, type InsertWeeklyReport,
  type SandwichCollection, type InsertSandwichCollection,
  type MeetingMinutes, type InsertMeetingMinutes,
  type DriveLink, type InsertDriveLink,
  type AgendaItem, type InsertAgendaItem,
  type Meeting, type InsertMeeting,
  type DriverAgreement, type InsertDriverAgreement,
  type Driver, type InsertDriver,
  type Host, type InsertHost,
  type HostContact, type InsertHostContact,
  type Recipient, type InsertRecipient,
  type Contact, type InsertContact,
  type Committee, type InsertCommittee,
  type CommitteeMembership, type InsertCommitteeMembership
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, isNull, ne, isNotNull, gt, gte, lte, inArray, like } from "drizzle-orm";
import type { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // Users (required for authentication)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Legacy user methods (for backwards compatibility)
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user || undefined;
  }

  // Projects
  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }

  async updateProject(id: number, updates: Partial<Project>): Promise<Project | undefined> {
    // Get the current project to check its current state
    const currentProject = await this.getProject(id);
    if (!currentProject) return undefined;

    // Auto-update status based on assignee changes
    const updateData = { ...updates, updatedAt: new Date() };

    // If assigneeName is being set and project is currently available, change to in_progress
    if (updateData.assigneeName && updateData.assigneeName.trim() && currentProject.status === "available") {
      updateData.status = "in_progress";
    }
    // If assigneeName is being removed and project is currently in_progress, change to available
    else if (updateData.assigneeName === "" && currentProject.status === "in_progress") {
      updateData.status = "available";
    }

    const [project] = await db.update(projects).set(updateData).where(eq(projects.id, id)).returning();
    return project || undefined;
  }

  async deleteProject(id: number): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Project Tasks
  async getProjectTasks(projectId: number): Promise<ProjectTask[]> {
    return await db.select().from(projectTasks).where(eq(projectTasks.projectId, projectId)).orderBy(projectTasks.order);
  }

  async getProjectTask(taskId: number): Promise<ProjectTask | undefined> {
    const [task] = await db.select().from(projectTasks).where(eq(projectTasks.id, taskId));
    return task || undefined;
  }

  async createProjectTask(insertTask: InsertProjectTask): Promise<ProjectTask> {
    const [task] = await db.insert(projectTasks).values(insertTask).returning();
    return task;
  }

  async updateProjectTask(id: number, updates: Partial<ProjectTask>): Promise<ProjectTask | undefined> {
    // Log for debugging
    console.log(`Updating task ${id} with updates:`, updates);

    // Handle timestamp fields properly and filter out fields that shouldn't be updated
    const processedUpdates = { ...updates };

    // Remove fields that shouldn't be updated directly
    delete processedUpdates.id;
    delete processedUpdates.projectId;
    delete processedUpdates.createdAt;

    if (processedUpdates.completedAt && typeof processedUpdates.completedAt === 'string') {
      processedUpdates.completedAt = new Date(processedUpdates.completedAt);
    }
    if (processedUpdates.dueDate && typeof processedUpdates.dueDate === 'string') {
      processedUpdates.dueDate = new Date(processedUpdates.dueDate);
    }

    // Always update the updatedAt timestamp
    processedUpdates.updatedAt = new Date();

    console.log(`Processed updates for task ${id}:`, processedUpdates);

    try {
      const [task] = await db.update(projectTasks).set(processedUpdates).where(eq(projectTasks.id, id)).returning();
      console.log(`Task ${id} updated successfully:`, task);
      return task || undefined;
    } catch (error) {
      console.error(`Error updating task ${id}:`, error);
      throw error;
    }
  }

  async deleteProjectTask(id: number): Promise<boolean> {
    const result = await db.delete(projectTasks).where(eq(projectTasks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getProjectCongratulations(projectId: number): Promise<any[]> {
    const result = await db.select().from(notifications)
      .where(
        and(
          eq(notifications.relatedType, 'project'),
          eq(notifications.relatedId, projectId),
          eq(notifications.type, 'congratulations')
        )
      )
      .orderBy(desc(notifications.createdAt));
    return result;
  }

  async getTaskById(id: number): Promise<ProjectTask | undefined> {
    const result = await db.select().from(projectTasks)
      .where(eq(projectTasks.id, id))
      .limit(1);
    return result[0];
  }

  async updateTaskStatus(id: number, status: string): Promise<boolean> {
    const result = await db.update(projectTasks)
      .set({ status: status })
      .where(eq(projectTasks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Task completion methods
  async createTaskCompletion(completion: InsertTaskCompletion): Promise<TaskCompletion> {
    const [result] = await db.insert(taskCompletions).values(completion).returning();
    return result;
  }

  async getTaskCompletions(taskId: number): Promise<TaskCompletion[]> {
    return await db.select().from(taskCompletions)
      .where(eq(taskCompletions.taskId, taskId))
      .orderBy(taskCompletions.completedAt);
  }

  async removeTaskCompletion(taskId: number, userId: string): Promise<boolean> {
    const result = await db.delete(taskCompletions)
      .where(and(
        eq(taskCompletions.taskId, taskId),
        eq(taskCompletions.userId, userId)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  // Project Comments
  async getProjectComments(projectId: number): Promise<ProjectComment[]> {
    return await db.select().from(projectComments).where(eq(projectComments.projectId, projectId)).orderBy(desc(projectComments.createdAt));
  }

  async createProjectComment(insertComment: InsertProjectComment): Promise<ProjectComment> {
    const [comment] = await db.insert(projectComments).values(insertComment).returning();
    return comment;
  }

  async deleteProjectComment(id: number): Promise<boolean> {
    const result = await db.delete(projectComments).where(eq(projectComments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Messages
  async getAllMessages(): Promise<Message[]> {
    try {
      const result = await db
        .select({
          id: messages.id,
          content: messages.content,
          sender: messages.sender,
          timestamp: messages.createdAt,
          userId: messages.userId,
          conversationId: messages.conversationId
        })
        .from(messages)
        .orderBy(messages.createdAt);

      return result;
    } catch (error) {
      // If sender column doesn't exist, query without it and add default sender
      console.log('Sender column not found, using fallback query');
      const result = await db
        .select({
          id: messages.id,
          content: messages.content,
          timestamp: messages.createdAt,
          userId: messages.userId,
          conversationId: messages.conversationId
        })
        .from(messages)
        .orderBy(messages.createdAt);

      // Add default sender for compatibility
      return result.map(msg => ({
        ...msg,
        sender: 'Unknown User'
      }));
    }
  }

  async getRecentMessages(limit: number): Promise<Message[]> {
    return await db.select().from(messages).orderBy(messages.id).limit(limit);
  }

  // REMOVED: getMessagesByCommittee - no longer needed with new conversation system

  // UPDATED: Get messages by conversationId (preferred method)
  async getMessagesByConversationId(conversationId: number): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  // ALIAS: getMessagesByThreadId for backwards compatibility
  async getMessagesByThreadId(threadId: number): Promise<Message[]> {
    return await this.getMessagesByConversationId(threadId);
  }

  // ALIAS: getMessages for backwards compatibility
  async getMessages(messageContext: string, limit?: number): Promise<Message[]> {
    if (limit) {
      return await this.getRecentMessages(limit);
    } else {
      // For backwards compatibility, return all messages since committee filtering is removed
      return await this.getAllMessages();
    }
  }

  // NEW: Get or create conversation for specific conversation types
  async getOrCreateThreadId(type: string, referenceId?: string): Promise<number> {
    try {
      // For the new simple system, we'll use conversation IDs as thread IDs
      // Check if conversation already exists
      const [existing] = await db.select()
        .from(conversations)
        .where(and(
          eq(conversations.type, type),
          referenceId ? eq(conversations.name, referenceId) : isNull(conversations.name)
        ));

      if (existing) {
        return existing.id;
      }

      // Create new conversation
      const [newConversation] = await db.insert(conversations).values({
        type,
        name: referenceId || this.generateThreadTitle(type, referenceId),
      }).returning();

      return newConversation.id;
    } catch (error) {
      console.error("Error getting/creating conversation:", error);
      throw error;
    }
  }

  private generateThreadTitle(type: string, referenceId?: string): string {
    switch (type) {
      case 'general': return 'General Chat';
      case 'committee': return `Committee Chat - ${referenceId}`;
      case 'host': return 'Host Chat';
      case 'driver': return 'Driver Chat';
      case 'recipient': return 'Recipient Chat';
      case 'core_team': return 'Core Team';
      case 'direct': return `Direct Messages - ${referenceId}`;
      case 'group': return `Group Chat - ${referenceId}`;
      default: return `${type} Chat`;
    }
  }

  // FIXED: Direct messages must use conversationId for proper isolation
  async getDirectMessages(userId1: string, userId2: string): Promise<Message[]> {
    // Create consistent reference ID for direct message conversation
    const userIds = [userId1, userId2].sort();
    const referenceId = userIds.join('_');
    const conversationId = await this.getOrCreateThreadId('direct', referenceId);

    console.log(`🔍 QUERY: getDirectMessages - conversationId: ${conversationId}, users: ${userId1} <-> ${userId2}, referenceId: ${referenceId}`);

    const messageResults = await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    console.log(`🔍 RESULT: Found ${messageResults.length} direct messages for conversationId ${conversationId}`);
    return messageResults;
  }

  async getMessageById(id: number): Promise<Message | undefined> {
    console.log(`[DEBUG] getMessageById called with id: ${id}`);
    try {
      const [message] = await db.select().from(messages).where(eq(messages.id, id));
      console.log(`[DEBUG] getMessageById result:`, message);
      return message || undefined;
    } catch (error) {
      console.error(`[ERROR] getMessageById failed for id ${id}:`, error);
      return undefined;
    }
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    // Ensure conversationId is set for proper conversation isolation
    if (!insertMessage.conversationId) {
      // Auto-assign conversationId based on message type
      let conversationType = 'channel';
      let conversationName = 'general'; // Default to general chat

      // For now, create a general conversation if none exists
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.type, 'channel'),
            eq(conversations.name, 'general')
          )
        )
        .limit(1);

      if (conversation) {
        insertMessage.conversationId = conversation.id;
        console.log(`✅ SEND: Using existing conversationId ${conversation.id} for general message from ${insertMessage.userId}`);
      } else {
        // Create new general conversation
        const [newConversation] = await db
          .insert(conversations)
          .values({
            type: 'channel',
            name: 'general'
          })
          .returning();
        
        insertMessage.conversationId = newConversation.id;
        console.log(`✅ SEND: Created new conversationId ${newConversation.id} for general message from ${insertMessage.userId}`);
      }
    } else {
      console.log(`🔄 SEND: Using existing conversationId ${insertMessage.conversationId} for message from ${insertMessage.userId}`);
    }

    const [message] = await db.insert(messages).values(insertMessage).returning();
    console.log(`📤 MESSAGE SENT: id=${message.id}, conversationId=${message.conversationId}, sender=${message.userId}`);
    return message;
  }

  async getThreadMessages(threadId: number): Promise<Message[]> {
    console.log(`🔍 QUERY: getThreadMessages - threadId: ${threadId}`);
    const messageResults = await db.select().from(messages).where(eq(messages.conversationId, threadId)).orderBy(messages.createdAt);
    console.log(`🔍 RESULT: Found ${messageResults.length} messages for threadId ${threadId}`);
    return messageResults;
  }

  async createReply(insertMessage: InsertMessage, parentId: number): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    await this.updateReplyCount(parentId);
    return message;
  }

  async updateReplyCount(messageId: number): Promise<void> {
    await db.update(messages)
      .set({ replyCount: sql`${messages.replyCount} + 1` })
      .where(eq(messages.id, messageId));
  }

  async deleteMessage(id: number): Promise<boolean> {
    console.log(`[DEBUG] deleteMessage called with id: ${id}`);
    try {
      const result = await db.delete(messages).where(eq(messages.id, id));
      console.log(`[DEBUG] deleteMessage result:`, result);
      const success = (result.rowCount ?? 0) > 0;
      console.log(`[DEBUG] deleteMessage success: ${success}`);
      return success;
    } catch (error) {
      console.error(`[ERROR] deleteMessage failed for id ${id}:`, error);
      return false;
    }
  }

  // REMOVED: Old group messaging methods - replaced with simple conversation system
  // These methods referenced non-existent tables (messageGroups, groupMessageParticipants)
  // The new system uses conversations, conversationParticipants, and messages tables

  // Weekly Reports
  async getAllWeeklyReports(): Promise<WeeklyReport[]> {
    return await db.select().from(weeklyReports).orderBy(weeklyReports.id);
  }

  async createWeeklyReport(insertReport: InsertWeeklyReport): Promise<WeeklyReport> {
    const [report] = await db.insert(weeklyReports).values(insertReport).returning();
    return report;
  }

  // Sandwich Collections
  async getAllSandwichCollections(): Promise<SandwichCollection[]> {
    return await db.select().from(sandwichCollections).orderBy(desc(sandwichCollections.collectionDate));
  }

  async getSandwichCollections(limit: number, offset: number): Promise<SandwichCollection[]> {
    return await db.select()
      .from(sandwichCollections)
      .orderBy(desc(sandwichCollections.collectionDate))
      .limit(limit)
      .offset(offset);
  }

  async getSandwichCollectionsCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(sandwichCollections);
    return Number(result[0].count);
  }

  async getCollectionStats(): Promise<{ totalEntries: number; totalSandwiches: number; }> {
    const result = await db.select({ 
      totalEntries: sql<number>`count(*)::int`,
      totalSandwiches: sql<number>`coalesce(sum(individual_sandwiches), 0)::int`
    }).from(sandwichCollections);

    return {
      totalEntries: Number(result[0].totalEntries),
      totalSandwiches: Number(result[0].totalSandwiches)
    };
  }

  async createSandwichCollection(insertCollection: InsertSandwichCollection): Promise<SandwichCollection> {
    const [collection] = await db.insert(sandwichCollections).values(insertCollection).returning();
    return collection;
  }

  async updateSandwichCollection(id: number, updates: Partial<SandwichCollection>): Promise<SandwichCollection | undefined> {
    const [collection] = await db.update(sandwichCollections).set(updates).where(eq(sandwichCollections.id, id)).returning();
    return collection || undefined;
  }

  async deleteSandwichCollection(id: number): Promise<boolean> {
    const result = await db.delete(sandwichCollections).where(eq(sandwichCollections.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Meeting Minutes
  async getAllMeetingMinutes(): Promise<MeetingMinutes[]> {
    return await db.select().from(meetingMinutes).orderBy(meetingMinutes.id);
  }

  async getRecentMeetingMinutes(limit: number): Promise<MeetingMinutes[]> {
    return await db.select().from(meetingMinutes).orderBy(meetingMinutes.id).limit(limit);
  }

  async createMeetingMinutes(insertMinutes: InsertMeetingMinutes): Promise<MeetingMinutes> {
    const [minutes] = await db.insert(meetingMinutes).values(insertMinutes).returning();
    return minutes;
  }

  async deleteMeetingMinutes(id: number): Promise<boolean> {
    const result = await db.delete(meetingMinutes).where(eq(meetingMinutes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Drive Links
  async getAllDriveLinks(): Promise<DriveLink[]> {
    return await db.select().from(driveLinks).orderBy(driveLinks.id);
  }

  async createDriveLink(insertLink: InsertDriveLink): Promise<DriveLink> {
    const [link] = await db.insert(driveLinks).values(insertLink).returning();
    return link;
  }

  // Agenda Items
  async getAllAgendaItems(): Promise<AgendaItem[]> {
    return await db.select().from(agendaItems).orderBy(agendaItems.id);
  }

  async createAgendaItem(insertItem: InsertAgendaItem): Promise<AgendaItem> {
    const [item] = await db.insert(agendaItems).values(insertItem).returning();
    return item;
  }

  async updateAgendaItemStatus(id: number, status: string): Promise<AgendaItem | undefined> {
    const [item] = await db.update(agendaItems).set({ status }).where(eq(agendaItems.id, id)).returning();
    return item || undefined;
  }

  async updateAgendaItem(id: number, updates: Partial<AgendaItem>): Promise<AgendaItem | undefined> {
    const [item] = await db.update(agendaItems).set(updates).where(eq(agendaItems.id, id)).returning();
    return item || undefined;
  }

  async deleteAgendaItem(id: number): Promise<boolean> {
    const result = await db.delete(agendaItems).where(eq(agendaItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Meetings
  async getCurrentMeeting(): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.status, 'active')).limit(1);
    return meeting || undefined;
  }

  async getAllMeetings(): Promise<Meeting[]> {
    return await db.select().from(meetings).orderBy(desc(meetings.date));
  }

  async getMeetingsByType(type: string): Promise<Meeting[]> {
    return await db.select().from(meetings).where(eq(meetings.type, type)).orderBy(desc(meetings.date));
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const [meeting] = await db.insert(meetings).values(insertMeeting).returning();
    return meeting;
  }

  async updateMeetingAgenda(id: number, agenda: string): Promise<Meeting | undefined> {
    const [meeting] = await db.update(meetings).set({ finalAgenda: agenda }).where(eq(meetings.id, id)).returning();
    return meeting || undefined;
  }

  async updateMeeting(id: number, updates: Partial<Meeting>): Promise<Meeting | undefined> {
    const [meeting] = await db.update(meetings).set(updates).where(eq(meetings.id, id)).returning();
    return meeting || undefined;
  }

  async deleteMeeting(id: number): Promise<boolean> {
    const result = await db.delete(meetings).where(eq(meetings.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Driver Agreements
  async createDriverAgreement(insertAgreement: InsertDriverAgreement): Promise<DriverAgreement> {
    const [agreement] = await db.insert(driverAgreements).values(insertAgreement).returning();
    return agreement;
  }

  // Drivers
  async getAllDrivers(): Promise<Driver[]> {
    return await db.select().from(drivers).orderBy(drivers.name);
  }

  async getDriver(id: number): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver || undefined;
  }

  async createDriver(insertDriver: InsertDriver): Promise<Driver> {
    const [driver] = await db.insert(drivers).values(insertDriver).returning();
    return driver;
  }

  async updateDriver(id: number, updates: Partial<Driver>): Promise<Driver | undefined> {
    const [driver] = await db.update(drivers).set(updates).where(eq(drivers.id, id)).returning();
    return driver || undefined;
  }

  async deleteDriver(id: number): Promise<boolean> {
    const result = await db.delete(drivers).where(eq(drivers.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Hosts
  async getAllHosts(): Promise<Host[]> {
    return await db.select().from(hosts).orderBy(hosts.name);
  }

  async getHost(id: number): Promise<Host | undefined> {
    const [host] = await db.select().from(hosts).where(eq(hosts.id, id));
    return host || undefined;
  }

  async createHost(insertHost: InsertHost): Promise<Host> {
    const [host] = await db.insert(hosts).values(insertHost).returning();
    return host;
  }

  async updateHost(id: number, updates: Partial<Host>): Promise<Host | undefined> {
    const [host] = await db.update(hosts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(hosts.id, id))
      .returning();
    return host || undefined;
  }

  async deleteHost(id: number): Promise<boolean> {
    // First check if this host has any associated sandwich collections
    const host = await db.select().from(hosts).where(eq(hosts.id, id)).limit(1);
    if (host.length === 0) {
      return false; // Host doesn't exist
    }

    const hostName = host[0].name;
    const [collectionCount] = await db
      .select({ count: sql`count(*)` })
      .from(sandwichCollections)
      .where(eq(sandwichCollections.hostName, hostName));

    if (Number(collectionCount.count) > 0) {
      throw new Error(`Cannot delete host "${hostName}" because it has ${collectionCount.count} associated collection records. Please update or remove these records first.`);
    }

    // Also delete any host contacts first
    await db.delete(hostContacts).where(eq(hostContacts.hostId, id));

    // Now delete the host
    const result = await db.delete(hosts).where(eq(hosts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async updateCollectionHostNames(oldHostName: string, newHostName: string): Promise<number> {
    const result = await db
      .update(sandwichCollections)
      .set({ hostName: newHostName })
      .where(eq(sandwichCollections.hostName, oldHostName));
    return result.rowCount ?? 0;
  }

  // Recipients
  async getAllRecipients(): Promise<Recipient[]> {
    return await db.select().from(recipients).orderBy(recipients.name);
  }

  async getRecipient(id: number): Promise<Recipient | undefined> {
    const [recipient] = await db.select().from(recipients).where(eq(recipients.id, id));
    return recipient || undefined;
  }

  async createRecipient(insertRecipient: InsertRecipient): Promise<Recipient> {
    const [recipient] = await db.insert(recipients).values(insertRecipient).returning();
    return recipient;
  }

  async updateRecipient(id: number, updates: Partial<Recipient>): Promise<Recipient | undefined> {
    const [recipient] = await db.update(recipients).set(updates).where(eq(recipients.id, id)).returning();
    return recipient || undefined;
  }

  async deleteRecipient(id: number): Promise<boolean> {
    const result = await db.delete(recipients).where(eq(recipients.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // General Contacts
  async getAllContacts(): Promise<Contact[]> {
    return await db.select().from(contacts).orderBy(contacts.name);
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact || undefined;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }

  async updateContact(id: number, updates: Partial<Contact>): Promise<Contact | undefined> {
    const [contact] = await db.update(contacts).set(updates).where(eq(contacts.id, id)).returning();
    return contact || undefined;
  }

  async deleteContact(id: number): Promise<boolean> {
    const result = await db.delete(contacts).where(eq(contacts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Host Contact methods
  async createHostContact(insertContact: InsertHostContact): Promise<HostContact> {
    const [contact] = await db.insert(hostContacts).values(insertContact).returning();
    return contact;
  }

  async getHostContacts(hostId: number): Promise<HostContact[]> {
    return await db.select().from(hostContacts).where(eq(hostContacts.hostId, hostId));
  }

  async updateHostContact(id: number, updates: Partial<HostContact>): Promise<HostContact | undefined> {
    const [contact] = await db.update(hostContacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(hostContacts.id, id))
      .returning();
    return contact;
  }

  async deleteHostContact(id: number): Promise<boolean> {
    const result = await db.delete(hostContacts).where(eq(hostContacts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Optimized query to get all hosts with their contacts in one call
  async getAllHostsWithContacts(): Promise<Array<Host & { contacts: HostContact[] }>> {
    const hostsData = await db.select().from(hosts).orderBy(hosts.name);
    const contactsData = await db.select().from(hostContacts);

    return hostsData.map(host => ({
      ...host,
      contacts: contactsData.filter(contact => contact.hostId === host.id)
    }));
  }

  // Project Assignments
  async getProjectAssignments(projectId: number): Promise<ProjectAssignment[]> {
    return await db.select().from(projectAssignments).where(eq(projectAssignments.projectId, projectId));
  }

  async createProjectAssignment(assignment: InsertProjectAssignment): Promise<ProjectAssignment> {
    const [created] = await db.insert(projectAssignments).values(assignment).returning();
    return created;
  }

  async deleteProjectAssignment(projectId: number, userId: string): Promise<boolean> {
    const result = await db.delete(projectAssignments)
      .where(and(
        eq(projectAssignments.projectId, projectId),
        eq(projectAssignments.userId, userId)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  async getUserProjectAssignments(userId: string): Promise<ProjectAssignment[]> {
    return await db.select().from(projectAssignments).where(eq(projectAssignments.userId, userId));
  }

  // Modified project methods to support user-specific visibility
  async getProjectsForUser(userId: string): Promise<Project[]> {
    // Get projects where user is assigned
    const assignedProjects = await db
      .select()
      .from(projects)
      .innerJoin(projectAssignments, eq(projects.id, projectAssignments.projectId))
      .where(eq(projectAssignments.userId, userId));

    return assignedProjects.map(result => result.projects);
  }

  async getAllProjectsWithAssignments(): Promise<Array<Project & { assignments: ProjectAssignment[] }>> {
    const projectsData = await db.select().from(projects).orderBy(projects.createdAt);
    const assignmentsData = await db.select().from(projectAssignments);

    return projectsData.map(project => ({
      ...project,
      assignments: assignmentsData.filter(assignment => assignment.projectId === project.id)
    }));
  }

  // Committee management
  async getAllCommittees(): Promise<Committee[]> {
    return await db.select().from(committees).orderBy(committees.createdAt);
  }

  async getCommittee(id: number): Promise<Committee | undefined> {
    const [committee] = await db.select().from(committees).where(eq(committees.id, id));
    return committee || undefined;
  }

  async createCommittee(committee: InsertCommittee): Promise<Committee> {
    const [newCommittee] = await db.insert(committees).values(committee).returning();
    return newCommittee;
  }

  async updateCommittee(id: number, updates: Partial<Committee>): Promise<Committee | undefined> {
    const [committee] = await db
      .update(committees)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(committees.id, id))
      .returning();
    return committee || undefined;
  }

  async deleteCommittee(id: number): Promise<boolean> {
    const result = await db.delete(committees).where(eq(committees.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Committee membership management
  async getUserCommittees(userId: string): Promise<Array<Committee & { membership: CommitteeMembership }>> {
    const userCommittees = await db
      .select()
      .from(committeeMemberships)
      .innerJoin(committees, eq(committeeMemberships.committeeId, committees.id))
      .where(eq(committeeMemberships.userId, userId));

    return userCommittees.map(result => ({
      ...result.committees,
      membership: result.committee_memberships
    }));
  }

  async getCommitteeMembers(committeeId: number): Promise<Array<User & { membership: CommitteeMembership }>> {
    const members = await db
      .select()
      .from(committeeMemberships)
      .innerJoin(users, eq(committeeMemberships.userId, users.id))
      .where(eq(committeeMemberships.committeeId, committeeId));

    return members.map(result => ({
      ...result.users,
      membership: result.committee_memberships
    }));
  }

  async addUserToCommittee(membership: InsertCommitteeMembership): Promise<CommitteeMembership> {
    const [newMembership] = await db.insert(committeeMemberships).values(membership).returning();
    return newMembership;
  }

  async updateCommitteeMembership(id: number, updates: Partial<CommitteeMembership>): Promise<CommitteeMembership | undefined> {
    const [membership] = await db
      .update(committeeMemberships)
      .set(updates)
      .where(eq(committeeMemberships.id, id))
      .returning();
    return membership || undefined;
  }

  async removeUserFromCommittee(userId: string, committeeId: number): Promise<boolean> {
    const result = await db
      .delete(committeeMemberships)
      .where(and(eq(committeeMemberships.userId, userId), eq(committeeMemberships.committeeId, committeeId)));
    return (result.rowCount ?? 0) > 0;
  }

  async isUserCommitteeMember(userId: string, committeeId: number): Promise<boolean> {
    const [membership] = await db
      .select()
      .from(committeeMemberships)
      .where(and(eq(committeeMemberships.userId, userId), eq(committeeMemberships.committeeId, committeeId)));
    return !!membership;
  }

  // Notifications & Celebrations
  async getUserNotifications(userId: string): Promise<any[]> {
    // For now return empty array - notifications can be implemented later
    return [];
  }

  async createNotification(notification: any): Promise<any> {
    // Basic notification creation - can be enhanced later
    return notification;
  }

  async markNotificationRead(id: number): Promise<boolean> {
    // For now return true - can be implemented later
    return true;
  }

  async deleteNotification(id: number): Promise<boolean> {
    // For now return true - can be implemented later
    return true;
  }

  async createCelebration(userId: string, taskId: number, message: string): Promise<any> {
    // For now return basic celebration object - can be implemented later
    return { userId, taskId, message, type: 'celebration' };
  }

  // Announcements
  async getAllAnnouncements(): Promise<any[]> {
    // For now return empty array - announcements can be implemented later
    return [];
  }

  async createAnnouncement(announcement: any): Promise<any> {
    // Basic announcement creation - can be enhanced later
    return announcement;
  }

  async updateAnnouncement(id: number, updates: any): Promise<any | undefined> {
    // For now return the updates - can be implemented later
    return updates;
  }

  async deleteAnnouncement(id: number): Promise<boolean> {
    // For now return true - can be implemented later
    return true;
  }

  // Consolidated notification methods (removing duplicates)
  async markNotificationAsRead(notificationId: number): Promise<boolean> {
    try {
      const result = await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, notificationId));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    try {
      const result = await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      return false;
    }
  }

  // Project assignments
  async getProjectAssignments(projectId: number): Promise<any[]> {
    try {
      const assignments = await db
        .select({
          id: projectAssignments.id,
          projectId: projectAssignments.projectId,
          userId: projectAssignments.userId,
          role: projectAssignments.role,
          assignedAt: projectAssignments.assignedAt,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role
          }
        })
        .from(projectAssignments)
        .leftJoin(users, eq(projectAssignments.userId, users.id))
        .where(eq(projectAssignments.projectId, projectId))
        .orderBy(projectAssignments.assignedAt);
      
      return assignments;
    } catch (error) {
      console.error('Error fetching project assignments:', error);
      return [];
    }
  }

  async addProjectAssignment(assignment: { projectId: number; userId: string; role: string }): Promise<any> {
    try {
      const [newAssignment] = await db
        .insert(projectAssignments)
        .values({
          projectId: assignment.projectId,
          userId: assignment.userId,
          role: assignment.role,
          assignedAt: new Date()
        })
        .returning();
      
      return newAssignment;
    } catch (error) {
      console.error('Error adding project assignment:', error);
      return null;
    }
  }

  async removeProjectAssignment(projectId: number, userId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(projectAssignments)
        .where(and(
          eq(projectAssignments.projectId, projectId),
          eq(projectAssignments.userId, userId)
        ));
      
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error removing project assignment:', error);
      return false;
    }
  }

  async updateProjectAssignment(projectId: number, userId: string, updates: { role: string }): Promise<any> {
    try {
      const [updatedAssignment] = await db
        .update(projectAssignments)
        .set({ role: updates.role })
        .where(and(
          eq(projectAssignments.projectId, projectId),
          eq(projectAssignments.userId, userId)
        ))
        .returning();
      
      return updatedAssignment;
    } catch (error) {
      console.error('Error updating project assignment:', error);
      return null;
    }
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing database storage...');

      // Test database connection
      await this.testConnection();

      // Check and add missing sender column if needed
      try {
        await db.execute(sql`SELECT sender FROM messages LIMIT 1`);
        console.log('Sender column exists');
      } catch (error) {
        console.log('Adding missing sender column to messages table...');
        try {
          await db.execute(sql`ALTER TABLE messages ADD COLUMN sender TEXT DEFAULT 'Unknown User'`);
          console.log('Sender column added successfully');
        } catch (alterError) {
          console.log('Could not add sender column, will use fallback queries');
        }
      }

      console.log('Database storage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database storage:', error);
      throw error;
    }
  }
}