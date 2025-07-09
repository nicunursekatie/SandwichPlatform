import { google } from 'googleapis';
import type { 
  User, InsertUser, Project, InsertProject, Message, InsertMessage,
  WeeklyReport, InsertWeeklyReport, SandwichCollection, InsertSandwichCollection,
  MeetingMinutes, InsertMeetingMinutes, DriveLink, InsertDriveLink
} from '@shared/schema';
import type { IStorage } from './storage';

export class GoogleSheetsStorage implements IStorage {
  private sheets: any;
  private spreadsheetId: string;

  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!;
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
  }

  private async ensureWorksheets() {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const existingSheets = response.data.sheets?.map((sheet: any) => sheet.properties.title) || [];
      const requiredSheets = [
        'Users', 'Projects', 'Messages', 'WeeklyReports', 
        'SandwichCollections', 'MeetingMinutes', 'DriveLinks'
      ];

      const sheetsToCreate = requiredSheets.filter(sheet => !existingSheets.includes(sheet));

      if (sheetsToCreate.length > 0) {
        const requests = sheetsToCreate.map(title => ({
          addSheet: {
            properties: { title }
          }
        }));

        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: { requests }
        });
      }

      // Add headers to new sheets
      for (const sheetName of sheetsToCreate) {
        await this.addHeaders(sheetName);
      }
    } catch (error) {
      console.error('Google Sheets access error:', error);
      throw new Error('Google Sheets permission denied. Please ensure the service account has access to the spreadsheet.');
    }
  }

  private async addHeaders(sheetName: string) {
    const headers: { [key: string]: string[] } = {
      'Users': ['id', 'username', 'email', 'fullName'],
      'Projects': ['id', 'title', 'description', 'status', 'assigneeId', 'assigneeName', 'color'],
      'Messages': ['id', 'sender', 'content', 'timestamp', 'parentId', 'threadId', 'replyCount', 'committee'],
      'WeeklyReports': ['id', 'weekEnding', 'sandwichCount', 'notes', 'submittedBy', 'submittedAt'],
      'SandwichCollections': ['Date Collected', 'Host Group', 'Solo Sandwiches', 'Group Contributors', 'Logged At'],
      'MeetingMinutes': ['id', 'title', 'date', 'summary', 'color'],
      'DriveLinks': ['id', 'title', 'description', 'url', 'icon', 'iconColor']
    };

    if (headers[sheetName]) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers[sheetName]]
        }
      });
    }
  }

  private async getNextId(sheetName: string): Promise<number> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:A`,
      });

      const values = response.data.values || [];
      if (values.length <= 1) return 1; // First row is header

      const ids = values.slice(1).map((row: any[]) => parseInt(row[0]) || 0).filter(id => id > 0);
      return ids.length > 0 ? Math.max(...ids) + 1 : 1;
    } catch (error) {
      console.error(`Error getting next ID for ${sheetName}:`, error);
      return 1;
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    await this.ensureWorksheets();
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Users!A:D',
      });

      const rows = response.data.values || [];
      const userRow = rows.find((row: any[]) => parseInt(row[0]) === id);
      
      if (userRow) {
        return {
          id: parseInt(userRow[0]),
          username: userRow[1],
          email: userRow[2],
          fullName: userRow[3]
        };
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    await this.ensureWorksheets();
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Users!A:D',
      });

      const rows = response.data.values || [];
      const userRow = rows.find((row: any[]) => row[1] === username);
      
      if (userRow) {
        return {
          id: parseInt(userRow[0]),
          username: userRow[1],
          email: userRow[2],
          fullName: userRow[3]
        };
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    await this.ensureWorksheets();
    
    const id = await this.getNextId('Users');
    const user: User = { ...insertUser, id };

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Users!A:D',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[user.id, user.username, user.email, user.fullName]]
        }
      });

      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Project methods
  async getAllProjects(): Promise<Project[]> {
    await this.ensureWorksheets();
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Projects!A:G',
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return []; // Only header row

      return rows.slice(1).map((row: any[]) => ({
        id: parseInt(row[0]) || 0,
        title: row[1] || '',
        description: row[2] || '',
        status: row[3] || '',
        assigneeId: row[4] ? parseInt(row[4]) : null,
        assigneeName: row[5] || null,
        color: row[6] || 'blue'
      })).filter(project => project.id > 0);
    } catch (error) {
      console.error('Error getting projects:', error);
      throw error;
    }
  }

  async getProject(id: number): Promise<Project | undefined> {
    const projects = await this.getAllProjects();
    return projects.find(p => p.id === id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    await this.ensureWorksheets();
    
    const id = await this.getNextId('Projects');
    const project: Project = { 
      ...insertProject, 
      id,
      assigneeId: insertProject.assigneeId || null,
      assigneeName: insertProject.assigneeName || null,
      color: insertProject.color || 'blue'
    };

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Projects!A:G',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            project.id, 
            project.title, 
            project.description, 
            project.status,
            project.assigneeId || '',
            project.assigneeName || '',
            project.color
          ]]
        }
      });

      return project;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  async updateProject(id: number, updates: Partial<Project>): Promise<Project | undefined> {
    const projects = await this.getAllProjects();
    const projectIndex = projects.findIndex(p => p.id === id);
    
    if (projectIndex === -1) return undefined;

    const currentProject = projects[projectIndex];
    const updateData = { ...updates };
    
    // Auto-update status based on assignee changes
    if (updateData.assigneeName && updateData.assigneeName.trim() && currentProject.status === "available") {
      updateData.status = "in_progress";
    }
    else if (updateData.assigneeName === "" && currentProject.status === "in_progress") {
      updateData.status = "available";
    }

    const updatedProject = { ...currentProject, ...updateData };
    
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Projects!A${projectIndex + 2}:G${projectIndex + 2}`, // +2 because of header and 0-based index
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            updatedProject.id,
            updatedProject.title,
            updatedProject.description,
            updatedProject.status,
            updatedProject.assigneeId || '',
            updatedProject.assigneeName || '',
            updatedProject.color
          ]]
        }
      });

      return updatedProject;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }

  // Message methods
  async getAllMessages(): Promise<Message[]> {
    await this.ensureWorksheets();
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Messages!A:H',
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return []; // Only header row

      return rows.slice(1).map((row: any[]) => ({
        id: parseInt(row[0]) || 0,
        sender: row[1] || '',
        content: row[2] || '',
        timestamp: new Date(row[3] || Date.now()),
        parentId: row[4] ? parseInt(row[4]) : null,
        threadId: row[5] ? parseInt(row[5]) : null,
        replyCount: parseInt(row[6]) || 0,
        committee: row[7] || 'general'
      })).filter(message => message.id > 0);
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  }

  async getRecentMessages(limit: number): Promise<Message[]> {
    const messages = await this.getAllMessages();
    return messages.slice(-limit);
  }

  async getMessagesByCommittee(committee: string): Promise<Message[]> {
    const messages = await this.getAllMessages();
    return messages.filter(m => m.committee === committee).sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    await this.ensureWorksheets();
    
    const id = await this.getNextId('Messages');
    const message: Message = { 
      ...insertMessage, 
      id,
      timestamp: new Date(),
      parentId: insertMessage.parentId || null,
      threadId: insertMessage.threadId || id,
      replyCount: 0,
      committee: insertMessage.committee || "general"
    };

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Messages!A:H',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            message.id,
            message.sender,
            message.content,
            message.timestamp.toISOString(),
            message.parentId || '',
            message.threadId || '',
            message.replyCount,
            message.committee
          ]]
        }
      });

      return message;
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  async getThreadMessages(threadId: number): Promise<Message[]> {
    const messages = await this.getAllMessages();
    return messages.filter(m => m.threadId === threadId).sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  async createReply(insertMessage: InsertMessage, parentId: number): Promise<Message> {
    const messages = await this.getAllMessages();
    const parentMessage = messages.find(m => m.id === parentId);
    
    if (!parentMessage) {
      throw new Error("Parent message not found");
    }

    const reply = await this.createMessage({
      ...insertMessage,
      parentId: parentId,
      threadId: parentMessage.threadId || parentMessage.id
    });

    await this.updateReplyCount(parentMessage.threadId || parentMessage.id);
    return reply;
  }

  async updateReplyCount(messageId: number): Promise<void> {
    const messages = await this.getAllMessages();
    const message = messages.find(m => m.id === messageId);
    
    if (message) {
      const replyCount = messages.filter(m => m.threadId === message.threadId && m.id !== message.id).length;
      
      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex !== -1) {
        try {
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `Messages!G${messageIndex + 2}`, // +2 for header and 0-based index
            valueInputOption: 'RAW',
            requestBody: {
              values: [[replyCount]]
            }
          });
        } catch (error) {
          console.error('Error updating reply count:', error);
        }
      }
    }
  }

  async deleteMessage(id: number): Promise<boolean> {
    const messages = await this.getAllMessages();
    const messageIndex = messages.findIndex(m => m.id === id);
    
    if (messageIndex === -1) return false;

    try {
      // Get sheet metadata to find the correct Messages sheet ID
      const spreadsheetInfo = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      
      const messagesSheet = spreadsheetInfo.data.sheets?.find(
        sheet => sheet.properties?.title === 'Messages'
      );
      
      if (!messagesSheet || !messagesSheet.properties) {
        console.error('Messages sheet not found');
        return false;
      }

      const sheetId = messagesSheet.properties.sheetId;
      
      // Delete the row from Google Sheets
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: messageIndex + 1, // +1 because of header
                endIndex: messageIndex + 2
              }
            }
          }]
        }
      });
      console.log(`Successfully deleted message ${id} from Google Sheets`);
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  }

  // Weekly Reports methods
  async getAllWeeklyReports(): Promise<WeeklyReport[]> {
    await this.ensureWorksheets();
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'WeeklyReports!A:F',
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return [];

      return rows.slice(1).map((row: any[]) => ({
        id: parseInt(row[0]) || 0,
        weekEnding: row[1] || '',
        sandwichCount: parseInt(row[2]) || 0,
        notes: row[3] || null,
        submittedBy: row[4] || '',
        submittedAt: new Date(row[5] || Date.now())
      })).filter(report => report.id > 0);
    } catch (error) {
      console.error('Error getting weekly reports:', error);
      return [];
    }
  }

  async createWeeklyReport(insertReport: InsertWeeklyReport): Promise<WeeklyReport> {
    await this.ensureWorksheets();
    
    const id = await this.getNextId('WeeklyReports');
    const report: WeeklyReport = { 
      ...insertReport, 
      id, 
      submittedAt: new Date(),
      notes: insertReport.notes || null
    };

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'WeeklyReports!A:F',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            report.id,
            report.weekEnding,
            report.sandwichCount,
            report.notes || '',
            report.submittedBy,
            report.submittedAt.toISOString()
          ]]
        }
      });

      return report;
    } catch (error) {
      console.error('Error creating weekly report:', error);
      throw error;
    }
  }

  // Sandwich Collections methods
  async getAllSandwichCollections(): Promise<SandwichCollection[]> {
    await this.ensureWorksheets();
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'SandwichCollections!A:E',
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return [];

      return rows.slice(1).map((row: any[], index: number) => ({
        id: index + 1, // Generate sequential ID since we're not storing it
        collectionDate: row[0] || '',        // Date Collected
        hostName: row[1] || '',              // Host Group
        individualSandwiches: parseInt(row[2]) || 0, // Solo Sandwiches
        groupCollections: row[3] || '',      // Group Contributors
        submittedAt: new Date(row[4] || Date.now()) // Logged At
      }));
    } catch (error) {
      console.error('Error getting sandwich collections:', error);
      return [];
    }
  }

  async createSandwichCollection(insertCollection: InsertSandwichCollection): Promise<SandwichCollection> {
    await this.ensureWorksheets();
    
    const id = await this.getNextId('SandwichCollections');
    const collection: SandwichCollection = { 
      ...insertCollection, 
      id, 
      submittedAt: new Date() 
    };

    try {
      // Format the new row according to the specified structure
      const newRow = [
        collection.collectionDate,      // Date Collected
        collection.hostName,            // Host Group
        collection.individualSandwiches, // Solo Sandwiches
        collection.groupCollections,    // Group Contributors
        collection.submittedAt.toISOString() // Logged At
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'SandwichCollections!A:E',
        valueInputOption: 'RAW',
        requestBody: {
          values: [newRow]
        }
      });

      return collection;
    } catch (error) {
      console.error('Error creating sandwich collection:', error);
      throw error;
    }
  }

  async updateSandwichCollection(id: number, updates: Partial<SandwichCollection>): Promise<SandwichCollection | undefined> {
    // Google Sheets update not implemented - return undefined to trigger fallback
    console.log(`Update operation for sandwich collection ${id} not implemented in Google Sheets, using fallback storage`);
    return undefined;
  }

  async deleteSandwichCollection(id: number): Promise<boolean> {
    try {
      await this.ensureWorksheets();
      const sheet = this.sheets.spreadsheets.values;
      
      // Get all data to find the row to delete
      const response = await sheet.get({
        spreadsheetId: this.spreadsheetId,
        range: 'SandwichCollections!A:F'
      });
      
      const rows = response.data.values || [];
      
      // Find the row with the matching ID (skip header row)
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (parseInt(rows[i][0]) === id) {
          rowIndex = i + 1; // Google Sheets is 1-indexed
          break;
        }
      }
      
      if (rowIndex === -1) {
        console.log(`Sandwich collection ${id} not found in Google Sheets`);
        return false;
      }
      
      // Delete the row by clearing its content and then removing it
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: await this.getSheetId('SandwichCollections'),
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex
              }
            }
          }]
        }
      });
      
      console.log(`Successfully deleted sandwich collection ${id} from Google Sheets`);
      return true;
    } catch (error) {
      console.error(`Failed to delete sandwich collection ${id} from Google Sheets:`, error);
      return false;
    }
  }

  private async getSheetId(sheetName: string): Promise<number> {
    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });
    
    const sheet = response.data.sheets?.find(s => s.properties?.title === sheetName);
    return sheet?.properties?.sheetId || 0;
  }

  // Meeting Minutes methods
  async getAllMeetingMinutes(): Promise<MeetingMinutes[]> {
    await this.ensureWorksheets();
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'MeetingMinutes!A:E',
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return [];

      return rows.slice(1).map((row: any[]) => ({
        id: parseInt(row[0]) || 0,
        title: row[1] || '',
        date: row[2] || '',
        summary: row[3] || '',
        color: row[4] || 'blue'
      })).filter(minutes => minutes.id > 0);
    } catch (error) {
      console.error('Error getting meeting minutes:', error);
      return [];
    }
  }

  async getRecentMeetingMinutes(limit: number): Promise<MeetingMinutes[]> {
    const minutes = await this.getAllMeetingMinutes();
    return minutes.slice(-limit);
  }

  async createMeetingMinutes(insertMinutes: InsertMeetingMinutes): Promise<MeetingMinutes> {
    await this.ensureWorksheets();
    
    const id = await this.getNextId('MeetingMinutes');
    const minutes: MeetingMinutes = { 
      ...insertMinutes, 
      id, 
      color: insertMinutes.color || 'blue' 
    };

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'MeetingMinutes!A:E',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            minutes.id,
            minutes.title,
            minutes.date,
            minutes.summary,
            minutes.color
          ]]
        }
      });

      return minutes;
    } catch (error) {
      console.error('Error creating meeting minutes:', error);
      throw error;
    }
  }

  // Drive Links methods
  async getAllDriveLinks(): Promise<DriveLink[]> {
    await this.ensureWorksheets();
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'DriveLinks!A:F',
      });

      const rows = response.data.values || [];
      if (rows.length <= 1) return [];

      return rows.slice(1).map((row: any[]) => ({
        id: parseInt(row[0]) || 0,
        title: row[1] || '',
        description: row[2] || '',
        url: row[3] || '',
        icon: row[4] || '',
        iconColor: row[5] || ''
      })).filter(link => link.id > 0);
    } catch (error) {
      console.error('Error getting drive links:', error);
      return [];
    }
  }

  async createDriveLink(insertLink: InsertDriveLink): Promise<DriveLink> {
    await this.ensureWorksheets();
    
    const id = await this.getNextId('DriveLinks');
    const link: DriveLink = { ...insertLink, id };

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'DriveLinks!A:F',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            link.id,
            link.title,
            link.description,
            link.url,
            link.icon,
            link.iconColor
          ]]
        }
      });

      return link;
    } catch (error) {
      console.error('Error creating drive link:', error);
      throw error;
    }
  }
}