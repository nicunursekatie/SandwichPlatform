import { MailService } from '@sendgrid/mail';
import { NotificationTypes, type NotificationType, type ProjectNotificationData, type EmailNotificationTemplate } from '@shared/notification-types';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY environment variable not set. Email notifications will be disabled.");
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

export class NotificationService {
  private static readonly FROM_EMAIL = 'noreply@thesandwichproject.org';
  
  static async sendProjectNotification(
    type: NotificationType,
    data: ProjectNotificationData,
    recipientEmails: string[]
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('Email notification skipped - no SendGrid API key configured');
      return false;
    }

    try {
      const template = this.getEmailTemplate(type, data);
      
      const emailData = {
        to: recipientEmails,
        from: this.FROM_EMAIL,
        subject: template.subject,
        html: template.body,
        text: template.body.replace(/<[^>]*>/g, '') // Strip HTML for text version
      };

      await mailService.send(emailData);
      console.log(`Email notification sent: ${type} to ${recipientEmails.length} recipients`);
      return true;
    } catch (error) {
      console.error('Failed to send email notification:', error);
      return false;
    }
  }

  private static getEmailTemplate(type: NotificationType, data: ProjectNotificationData): EmailNotificationTemplate {
    switch (type) {
      case NotificationTypes.PROJECT_ASSIGNED:
        return {
          subject: `You've been assigned to project: ${data.projectTitle}`,
          body: `
            <h2>New Project Assignment</h2>
            <p>You have been assigned to work on the project <strong>${data.projectTitle}</strong>.</p>
            ${data.assignedBy ? `<p>Assigned by: ${data.assignedBy}</p>` : ''}
            <p>Please log into the Sandwich Project platform to view project details and get started.</p>
            <p><a href="${process.env.REPL_URL || 'https://your-platform-url.com'}/projects/${data.projectId}">View Project</a></p>
          `,
          recipients: data.assignedTo || []
        };

      case NotificationTypes.PROJECT_UPDATED:
        return {
          subject: `Project updated: ${data.projectTitle}`,
          body: `
            <h2>Project Update</h2>
            <p>The project <strong>${data.projectTitle}</strong> has been updated.</p>
            <p>Please check the project page for the latest information.</p>
            <p><a href="${process.env.REPL_URL || 'https://your-platform-url.com'}/projects/${data.projectId}">View Project</a></p>
          `,
          recipients: data.assignedTo || []
        };

      case NotificationTypes.TASK_ADDED:
        return {
          subject: `New task added to ${data.projectTitle}`,
          body: `
            <h2>New Task Added</h2>
            <p>A new task <strong>${data.taskTitle}</strong> has been added to project <strong>${data.projectTitle}</strong>.</p>
            <p>Please check the project page to view task details.</p>
            <p><a href="${process.env.REPL_URL || 'https://your-platform-url.com'}/projects/${data.projectId}">View Project</a></p>
          `,
          recipients: data.assignedTo || []
        };

      case NotificationTypes.TASK_ASSIGNED:
        return {
          subject: `You've been assigned a task: ${data.taskTitle}`,
          body: `
            <h2>New Task Assignment</h2>
            <p>You have been assigned the task <strong>${data.taskTitle}</strong> in project <strong>${data.projectTitle}</strong>.</p>
            ${data.assignedBy ? `<p>Assigned by: ${data.assignedBy}</p>` : ''}
            <p><a href="${process.env.REPL_URL || 'https://your-platform-url.com'}/projects/${data.projectId}">View Project</a></p>
          `,
          recipients: data.assignedTo || []
        };

      case NotificationTypes.PROJECT_STATUS_CHANGED:
        return {
          subject: `Project status changed: ${data.projectTitle}`,
          body: `
            <h2>Project Status Update</h2>
            <p>The status of project <strong>${data.projectTitle}</strong> has changed from <strong>${data.oldStatus}</strong> to <strong>${data.newStatus}</strong>.</p>
            <p><a href="${process.env.REPL_URL || 'https://your-platform-url.com'}/projects/${data.projectId}">View Project</a></p>
          `,
          recipients: data.assignedTo || []
        };

      case NotificationTypes.PROJECT_DUE_REMINDER:
        return {
          subject: `Reminder: ${data.projectTitle} due soon`,
          body: `
            <h2>Project Due Date Reminder</h2>
            <p>The project <strong>${data.projectTitle}</strong> is due on <strong>${data.dueDate}</strong>.</p>
            <p>Please ensure all tasks are completed on time.</p>
            <p><a href="${process.env.REPL_URL || 'https://your-platform-url.com'}/projects/${data.projectId}">View Project</a></p>
          `,
          recipients: data.assignedTo || []
        };

      default:
        return {
          subject: `Update on project: ${data.projectTitle}`,
          body: `
            <h2>Project Update</h2>
            <p>There has been an update to project <strong>${data.projectTitle}</strong>.</p>
            <p><a href="${process.env.REPL_URL || 'https://your-platform-url.com'}/projects/${data.projectId}">View Project</a></p>
          `,
          recipients: data.assignedTo || []
        };
    }
  }
}