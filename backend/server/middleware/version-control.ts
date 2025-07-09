import { storage } from "../storage-wrapper";
import { AuditLogger } from "../audit-logger";

export interface VersionedRecord {
  id: string;
  entityType: 'sandwich_collection' | 'host' | 'project' | 'contact';
  entityId: number;
  version: number;
  data: any;
  changedFields: string[];
  changeType: 'create' | 'update' | 'delete';
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ChangesetRequest {
  entityType: string;
  entityId: number;
  changes: Record<string, any>;
  userId?: string;
  reason?: string;
}

export class VersionControl {
  private static versionHistory: Map<string, VersionedRecord[]> = new Map();

  static async createVersion(
    entityType: VersionedRecord['entityType'],
    entityId: number,
    changeType: VersionedRecord['changeType'],
    newData: any,
    previousData?: any,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<VersionedRecord> {
    const entityKey = `${entityType}:${entityId}`;
    const existingVersions = this.versionHistory.get(entityKey) || [];
    const version = existingVersions.length + 1;

    // Determine changed fields
    const changedFields: string[] = [];
    if (previousData && changeType === 'update') {
      Object.keys(newData).forEach(key => {
        if (JSON.stringify(newData[key]) !== JSON.stringify(previousData[key])) {
          changedFields.push(key);
        }
      });
    } else if (changeType === 'create') {
      changedFields.push(...Object.keys(newData));
    }

    const versionedRecord: VersionedRecord = {
      id: `${entityKey}:v${version}`,
      entityType,
      entityId,
      version,
      data: JSON.parse(JSON.stringify(newData)),
      changedFields,
      changeType,
      userId,
      timestamp: new Date(),
      metadata
    };

    // Store version
    existingVersions.push(versionedRecord);
    this.versionHistory.set(entityKey, existingVersions);

    // Log the change
    await AuditLogger.log(
      'version_created',
      entityType,
      entityId,
      {
        version,
        changeType,
        changedFields,
        reason: metadata?.reason
      },
      { userId }
    );

    return versionedRecord;
  }

  static async getVersionHistory(
    entityType: VersionedRecord['entityType'],
    entityId: number
  ): Promise<VersionedRecord[]> {
    const entityKey = `${entityType}:${entityId}`;
    return this.versionHistory.get(entityKey) || [];
  }

  static async getVersion(
    entityType: VersionedRecord['entityType'],
    entityId: number,
    version: number
  ): Promise<VersionedRecord | null> {
    const history = await this.getVersionHistory(entityType, entityId);
    return history.find(v => v.version === version) || null;
  }

  static async restoreVersion(
    entityType: VersionedRecord['entityType'],
    entityId: number,
    version: number,
    userId?: string
  ): Promise<boolean> {
    try {
      const versionToRestore = await this.getVersion(entityType, entityId, version);
      if (!versionToRestore) {
        throw new Error(`Version ${version} not found`);
      }

      // Get current data for comparison
      let currentData: any;
      switch (entityType) {
        case 'sandwich_collection':
          currentData = await storage.getSandwichCollection(entityId);
          break;
        case 'host':
          currentData = await storage.getHost(entityId);
          break;
        case 'project':
          currentData = await storage.getProject(entityId);
          break;
        case 'contact':
          currentData = await storage.getContact(entityId);
          break;
        default:
          throw new Error(`Unsupported entity type: ${entityType}`);
      }

      // Restore the data
      const restoredData = versionToRestore.data;
      switch (entityType) {
        case 'sandwich_collection':
          await storage.updateSandwichCollection(entityId, restoredData);
          break;
        case 'host':
          await storage.updateHost(entityId, restoredData);
          break;
        case 'project':
          await storage.updateProject(entityId, restoredData);
          break;
        case 'contact':
          await storage.updateContact(entityId, restoredData);
          break;
      }

      // Create a new version for the restoration
      await this.createVersion(
        entityType,
        entityId,
        'update',
        restoredData,
        currentData,
        userId,
        { 
          action: 'restore',
          restoredFromVersion: version,
          reason: `Restored from version ${version}`
        }
      );

      return true;
    } catch (error) {
      console.error('Failed to restore version:', error);
      return false;
    }
  }

  static async compareVersions(
    entityType: VersionedRecord['entityType'],
    entityId: number,
    version1: number,
    version2: number
  ): Promise<{
    added: Record<string, any>;
    modified: Record<string, { from: any; to: any }>;
    removed: Record<string, any>;
  }> {
    const v1 = await this.getVersion(entityType, entityId, version1);
    const v2 = await this.getVersion(entityType, entityId, version2);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const added: Record<string, any> = {};
    const modified: Record<string, { from: any; to: any }> = {};
    const removed: Record<string, any> = {};

    const allKeys = new Set([...Object.keys(v1.data), ...Object.keys(v2.data)]);

    for (const key of allKeys) {
      const val1 = v1.data[key];
      const val2 = v2.data[key];

      if (val1 === undefined && val2 !== undefined) {
        added[key] = val2;
      } else if (val1 !== undefined && val2 === undefined) {
        removed[key] = val1;
      } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        modified[key] = { from: val1, to: val2 };
      }
    }

    return { added, modified, removed };
  }

  static async createChangeset(request: ChangesetRequest): Promise<{
    success: boolean;
    versionId?: string;
    error?: string;
  }> {
    try {
      // Get current data
      let currentData: any;
      switch (request.entityType) {
        case 'sandwich_collection':
          currentData = await storage.getSandwichCollection(request.entityId);
          break;
        case 'host':
          currentData = await storage.getHost(request.entityId);
          break;
        case 'project':
          currentData = await storage.getProject(request.entityId);
          break;
        case 'contact':
          currentData = await storage.getContact(request.entityId);
          break;
        default:
          throw new Error(`Unsupported entity type: ${request.entityType}`);
      }

      if (!currentData) {
        throw new Error('Entity not found');
      }

      // Apply changes
      const updatedData = { ...currentData, ...request.changes };

      // Update the entity
      switch (request.entityType) {
        case 'sandwich_collection':
          await storage.updateSandwichCollection(request.entityId, updatedData);
          break;
        case 'host':
          await storage.updateHost(request.entityId, updatedData);
          break;
        case 'project':
          await storage.updateProject(request.entityId, updatedData);
          break;
        case 'contact':
          await storage.updateContact(request.entityId, updatedData);
          break;
      }

      // Create version
      const version = await this.createVersion(
        request.entityType as VersionedRecord['entityType'],
        request.entityId,
        'update',
        updatedData,
        currentData,
        request.userId,
        { reason: request.reason }
      );

      return {
        success: true,
        versionId: version.id
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async getChangeStats(
    entityType?: VersionedRecord['entityType'],
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalChanges: number;
    changesByType: Record<string, number>;
    changesByUser: Record<string, number>;
    recentActivity: VersionedRecord[];
  }> {
    let allVersions: VersionedRecord[] = [];

    // Collect all versions
    for (const versions of this.versionHistory.values()) {
      allVersions.push(...versions);
    }

    // Apply filters
    if (entityType) {
      allVersions = allVersions.filter(v => v.entityType === entityType);
    }
    if (userId) {
      allVersions = allVersions.filter(v => v.userId === userId);
    }
    if (startDate) {
      allVersions = allVersions.filter(v => v.timestamp >= startDate);
    }
    if (endDate) {
      allVersions = allVersions.filter(v => v.timestamp <= endDate);
    }

    // Calculate stats
    const changesByType = allVersions.reduce((acc, v) => {
      acc[v.changeType] = (acc[v.changeType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const changesByUser = allVersions.reduce((acc, v) => {
      const user = v.userId || 'system';
      acc[user] = (acc[user] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentActivity = allVersions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalChanges: allVersions.length,
      changesByType,
      changesByUser,
      recentActivity
    };
  }

  static async exportVersionHistory(
    entityType?: VersionedRecord['entityType'],
    entityId?: number
  ): Promise<VersionedRecord[]> {
    if (entityType && entityId) {
      return this.getVersionHistory(entityType, entityId);
    }

    let allVersions: VersionedRecord[] = [];
    for (const versions of this.versionHistory.values()) {
      if (!entityType || versions.some(v => v.entityType === entityType)) {
        allVersions.push(...versions.filter(v => !entityType || v.entityType === entityType));
      }
    }

    return allVersions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}