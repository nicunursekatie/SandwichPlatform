import { MailService } from '@sendgrid/mail';

const mailService = new MailService();

if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('SendGrid API key not configured');
      return false;
    }
    
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export async function sendDriverAgreementNotification(agreementData: any): Promise<boolean> {
  const emailContent = `
    New Volunteer Driver Agreement Submission

    Submitted By: ${agreementData.submittedBy}
    Email: ${agreementData.email}
    Phone: ${agreementData.phone}
    License Number: ${agreementData.licenseNumber}
    Vehicle Info: ${agreementData.vehicleInfo}
    Emergency Contact: ${agreementData.emergencyContact}
    Emergency Phone: ${agreementData.emergencyPhone}
    Agreement Accepted: ${agreementData.agreementAccepted ? 'Yes' : 'No'}
    Submitted At: ${new Date(agreementData.submittedAt).toLocaleString()}
  `;

  return sendEmail({
    to: 'admin@sandwichproject.org', // Replace with actual admin email
    from: 'noreply@sandwichproject.org', // Replace with verified sender
    subject: 'New Volunteer Driver Agreement Submission',
    text: emailContent,
    html: emailContent.replace(/\n/g, '<br>')
  });
}