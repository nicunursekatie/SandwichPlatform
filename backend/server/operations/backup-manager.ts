import { db } from "../db";
import { storage } from "../storage-wrapper";
import { AuditLogger } from "../audit-logger";
import fs from "fs/promises";
import path from "path";

export interface BackupManifest {
  id: string;
  timestamp: Date;
  version: string;
  tables: string[];
  recordCounts: Record<string, number>;
  fileSize: number;
  checksum: string;
  metadata: {
    triggeredBy: 'schedule' | 'manual' | 'migration';
    userId?: string;
    reason?: string;
  };
}

export interface RestoreOptions {
  backupId: string;
  tables?: string[];
  preserveAuditLogs?: boolean;
  dryRun?: boolean;
}

export class BackupManager {
  private static backupsPath = './backups';
  private static maxBackups = 30; // Keep last 30 backups

  static async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.backupsPath, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize backup directory:', error);
    }
  }

  static async createBackup(
    triggeredBy: BackupManifest['metadata']['triggeredBy'] = 'manual',
    userId?: string,
    reason?: string
  ): Promise<BackupManifest> {
    const backupId = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const backupDir = path.join(this.backupsPath, backupId);
    
    try {
      await fs.mkdir(backupDir, { recursive: true });
      
      // Get all data
      const collections = await storage.getAllSandwichCollections();
      const hosts = await storage.getAllHosts();
      const projects = await storage.getAllProjects();
      const contacts = await storage.getAllContacts();
      const auditLogs = await AuditLogger.getAuditHistory();

      // Create backup data structure
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          sandwich_collections: collections,
          hosts: hosts,
          projects: projects,
          contacts: contacts,
          audit_logs: auditLogs.logs
        }
      };

      // Write backup file
      const backupFile = path.join(backupDir, 'data.json');
      await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));

      // Calculate file size and checksum
      const stats = await fs.stat(backupFile);
      const checksum = await this.calculateChecksum(backupFile);

      // Create manifest
      const manifest: BackupManifest = {
        id: backupId,
        timestamp: new Date(),
        version: '1.0',
        tables: ['sandwich_collections', 'hosts', 'projects', 'contacts', 'audit_logs'],
        recordCounts: {
          sandwich_collections: collections.length,
          hosts: hosts.length,
          projects: projects.length,
          contacts: contacts.length,
          audit_logs: auditLogs.logs.length
        },
        fileSize: stats.size,
        checksum,
        metadata: {
          triggeredBy,
          userId,
          reason
        }
      };

      // Save manifest
      const manifestFile = path.join(backupDir, 'manifest.json');
      await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2));

      // Log backup creation
      await AuditLogger.log(
        'backup_created',
        'system',
        null,
        {
          backupId,
          recordCounts: manifest.recordCounts,
          fileSize: manifest.fileSize,
          triggeredBy
        },
        { userId }
      );

      // Clean up old backups
      await this.cleanupOldBackups();

      return manifest;

    } catch (error) {
      console.error('Backup creation failed:', error);
      
      // Clean up partial backup
      try {
        await fs.rm(backupDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Failed to clean up partial backup:', cleanupError);
      }
      
      throw error;
    }
  }

  static async listBackups(): Promise<BackupManifest[]> {
    try {
      const backupDirs = await fs.readdir(this.backupsPath);
      const manifests: BackupManifest[] = [];

      for (const dir of backupDirs) {
        if (dir.startsWith('backup_')) {
          try {
            const manifestPath = path.join(this.backupsPath, dir, 'manifest.json');
            const manifestData = await fs.readFile(manifestPath, 'utf8');
            manifests.push(JSON.parse(manifestData));
          } catch (error) {
            console.warn(`Failed to read manifest for backup ${dir}:`, error);
          }
        }
      }

      return manifests.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  static async getBackupInfo(backupId: string): Promise<BackupManifest | null> {
    try {
      const manifestPath = path.join(this.backupsPath, backupId, 'manifest.json');
      const manifestData = await fs.readFile(manifestPath, 'utf8');
      return JSON.parse(manifestData);
    } catch (error) {
      return null;
    }
  }

  static async validateBackup(backupId: string): Promise<{
    valid: boolean;
    errors: string[];
    manifest?: BackupManifest;
  }> {
    const errors: string[] = [];
    
    try {
      const manifest = await this.getBackupInfo(backupId);
      if (!manifest) {
        return { valid: false, errors: ['Backup manifest not found'] };
      }

      // Check if backup file exists
      const backupFile = path.join(this.backupsPath, backupId, 'data.json');
      try {
        await fs.access(backupFile);
      } catch {
        errors.push('Backup data file not found');
      }

      // Verify checksum
      try {
        const currentChecksum = await this.calculateChecksum(backupFile);
        if (currentChecksum !== manifest.checksum) {
          errors.push('Backup file checksum mismatch - file may be corrupted');
        }
      } catch (error) {
        errors.push('Failed to verify backup checksum');
      }

      // Validate backup data structure
      try {
        const backupData = JSON.parse(await fs.readFile(backupFile, 'utf8'));
        
        if (!backupData.data) {
          errors.push('Invalid backup structure - missing data section');
        }

        const requiredTables = ['sandwich_collections', 'hosts', 'projects', 'contacts'];
        for (const table of requiredTables) {
          if (!Array.isArray(backupData.data[table])) {
            errors.push(`Invalid backup data for table: ${table}`);
          }
        }
      } catch (error) {
        errors.push('Failed to parse backup data');
      }

      return {
        valid: errors.length === 0,
        errors,
        manifest
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Backup validation failed: ${error.message}`]
      };
    }
  }

  static async deleteBackup(backupId: string, userId?: string): Promise<boolean> {
    try {
      const backupDir = path.join(this.backupsPath, backupId);
      await fs.rm(backupDir, { recursive: true, force: true });

      await AuditLogger.log(
        'backup_deleted',
        'system',
        null,
        { backupId },
        { userId }
      );

      return true;
    } catch (error) {
      console.error('Failed to delete backup:', error);
      return false;
    }
  }

  static async getStorageStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup?: Date;
    newestBackup?: Date;
    diskUsage: string;
  }> {
    try {
      const backups = await this.listBackups();
      const totalSize = backups.reduce((sum, backup) => sum + backup.fileSize, 0);
      
      const stats = {
        totalBackups: backups.length,
        totalSize,
        oldestBackup: backups.length > 0 ? new Date(Math.min(...backups.map(b => b.timestamp.getTime()))) : undefined,
        newestBackup: backups.length > 0 ? new Date(Math.max(...backups.map(b => b.timestamp.getTime()))) : undefined,
        diskUsage: this.formatBytes(totalSize)
      };

      return stats;
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        totalBackups: 0,
        totalSize: 0,
        diskUsage: '0 B'
      };
    }
  }

  static async scheduleAutoBackup(): Promise<void> {
    // Create daily backup at 2 AM
    const now = new Date();
    const nextBackup = new Date(now);
    nextBackup.setHours(2, 0, 0, 0);
    
    if (nextBackup <= now) {
      nextBackup.setDate(nextBackup.getDate() + 1);
    }

    const timeUntilBackup = nextBackup.getTime() - now.getTime();
    
    setTimeout(async () => {
      try {
        await this.createBackup('schedule', 'system', 'Daily automated backup');
        // Schedule next backup
        this.scheduleAutoBackup();
      } catch (error) {
        console.error('Scheduled backup failed:', error);
        // Retry in 1 hour
        setTimeout(() => this.scheduleAutoBackup(), 60 * 60 * 1000);
      }
    }, timeUntilBackup);

    console.log(`Next automated backup scheduled for: ${nextBackup.toISOString()}`);
  }

  private static async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      if (backups.length > this.maxBackups) {
        const backupsToDelete = backups.slice(this.maxBackups);
        for (const backup of backupsToDelete) {
          await this.deleteBackup(backup.id, 'system');
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  private static async calculateChecksum(filePath: string): Promise<string> {
    try {
      const crypto = await import('crypto');
      const data = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(data).digest('hex');
    } catch (error) {
      console.error('Failed to calculate checksum:', error);
      return '';
    }
  }

  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}