import { supabase } from './supabase';
import { Colors } from '../constants/Colors';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Email template with app branding
function createEmailTemplate(title: string, content: string, actionUrl?: string, actionText?: string): EmailTemplate {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f8f9fa;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, ${Colors.primary} 0%, #000d1a 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        .subtitle {
          opacity: 0.9;
          font-size: 14px;
        }
        .content {
          padding: 30px;
        }
        .title {
          color: ${Colors.primary};
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 20px;
        }
        .message {
          margin-bottom: 25px;
          line-height: 1.6;
        }
        .button {
          display: inline-block;
          background: ${Colors.accent};
          color: ${Colors.text.primary};
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 20px 0;
        }
        .footer {
          background: #f8f9fa;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #e0e0e0;
        }
        .grid-pattern {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100px;
          background-image: 
            linear-gradient(90deg, ${Colors.accent}20 1px, transparent 1px),
            linear-gradient(0deg, ${Colors.accent}20 1px, transparent 1px);
          background-size: 20px 20px;
          opacity: 0.3;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="grid-pattern"></div>
          <div class="logo">Physics with Mr. Saddam</div>
          <div class="subtitle">Learn Physics Anywhere</div>
        </div>
        <div class="content">
          <div class="title">${title}</div>
          <div class="message">${content}</div>
          ${actionUrl && actionText ? `<a href="${actionUrl}" class="button">${actionText}</a>` : ''}
        </div>
        <div class="footer">
          <p>This email was sent from Physics with Mr. Saddam learning platform.</p>
          <p>If you have any questions, please contact your teacher or administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Physics with Mr. Saddam - ${title}
    
    ${content}
    
    ${actionUrl && actionText ? `${actionText}: ${actionUrl}` : ''}
    
    ---
    This email was sent from Physics with Mr. Saddam learning platform.
  `;

  return {
    subject: `Physics Learning - ${title}`,
    html,
    text
  };
}

// Send email using Supabase Edge Functions (you'll need to create this)
export async function sendEmail(to: string[], template: EmailTemplate) {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      },
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}

// Get user emails by criteria
export async function getUserEmails(criteria: {
  schoolId?: string;
  classId?: string;
  role?: string;
  gradeLevel?: string;
  userIds?: string[];
}): Promise<string[]> {
  try {
    let query = supabase.from('app_users').select('email');

    if (criteria.schoolId) {
      query = query.eq('school_id', criteria.schoolId);
    }
    if (criteria.classId) {
      // Get users enrolled in specific class
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_id', criteria.classId);
      
      if (enrollments) {
        const studentIds = enrollments.map(e => e.student_id);
        query = query.in('id', studentIds);
      }
    }
    if (criteria.role) {
      query = query.eq('role', criteria.role);
    }
    if (criteria.gradeLevel) {
      query = query.eq('grade_level', criteria.gradeLevel);
    }
    if (criteria.userIds) {
      query = query.in('id', criteria.userIds);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error getting user emails:', error);
      return [];
    }

    return data?.map(user => user.email).filter(email => email) || [];
  } catch (error) {
    console.error('Error getting user emails:', error);
    return [];
  }
}

// Predefined email templates
export async function sendAssignmentDueReminder(emails: string[], assignmentTitle: string, dueDate: string) {
  const template = createEmailTemplate(
    'Assignment Due Reminder',
    `This is a friendly reminder that your assignment "${assignmentTitle}" is due on ${new Date(dueDate).toLocaleDateString()}.
    
    Please make sure to submit your work before the deadline to avoid any late penalties.`,
    undefined,
    undefined
  );

  return await sendEmail(emails, template);
}

export async function sendNewVideoNotification(emails: string[], videoTitle: string, className: string) {
  const template = createEmailTemplate(
    'New Physics Video Available',
    `A new physics video "${videoTitle}" has been uploaded to your ${className} class.
    
    Log in to the platform to watch the video and enhance your physics knowledge!`,
    undefined,
    'Watch Video'
  );

  return await sendEmail(emails, template);
}

export async function sendGradeNotification(emails: string[], assignmentTitle: string, grade: number) {
  const template = createEmailTemplate(
    'Grade Released',
    `Your grade for "${assignmentTitle}" has been released.
    
    Grade: ${grade}%
    
    Log in to view detailed feedback and comments from your teacher.`,
    undefined,
    'View Grade'
  );

  return await sendEmail(emails, template);
}

export async function sendCustomEmail(emails: string[], title: string, message: string, actionUrl?: string, actionText?: string) {
  const template = createEmailTemplate(title, message, actionUrl, actionText);
  return await sendEmail(emails, template);
}

// Bulk email functions
export async function sendEmailToSchool(schoolId: string, title: string, message: string) {
  const emails = await getUserEmails({ schoolId });
  return await sendCustomEmail(emails, title, message);
}

export async function sendEmailToClass(classId: string, title: string, message: string) {
  const emails = await getUserEmails({ classId });
  return await sendCustomEmail(emails, title, message);
}

export async function sendEmailToRole(role: string, title: string, message: string) {
  const emails = await getUserEmails({ role });
  return await sendCustomEmail(emails, title, message);
}

export async function sendEmailToStudent(studentId: string, title: string, message: string) {
  const emails = await getUserEmails({ userIds: [studentId] });
  return await sendCustomEmail(emails, title, message);
}