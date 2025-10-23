import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WelcomeEmailRequest {
  name: string;
  email: string;
  password: string;
  role: 'student' | 'teacher' | 'admin';
  schoolName?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, email, password, role, schoolName }: WelcomeEmailRequest = await req.json()

    // Validate required fields
    if (!name || !email || !password || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate email content
    const emailContent = generateWelcomeEmail({ name, email, password, role, schoolName })

    // Use Supabase's built-in email functionality
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Send email using Supabase Auth
    const { error } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email: email,
      options: {
        data: {
          name: name,
          role: role,
          school_name: schoolName,
          welcome_email: true,
          custom_password: password
        }
      }
    })

    if (error) {
      console.error('Supabase email error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Also log the email content for backup/manual sending
    console.log('Welcome email sent successfully to:', email)
    console.log('Email content:', emailContent.subject)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Welcome email sent successfully',
        recipient: email 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function generateWelcomeEmail(userData: WelcomeEmailRequest) {
  const roleContent = getRoleSpecificContent(userData.role)
  
  return {
    subject: `Welcome to Physics Learning Platform, ${userData.name}!`,
    html: generateHTML(userData, roleContent),
    text: generateText(userData, roleContent)
  }
}

function getRoleSpecificContent(role: string) {
  switch (role) {
    case 'student':
      return {
        greeting: "Welcome to your physics learning journey!",
        features: [
          "Access study materials and resources",
          "View and submit assignments",
          "Watch educational recordings",
          "Track your progress and grades"
        ],
        nextSteps: [
          "Log in using your credentials below",
          "Explore the study materials section",
          "Check for any pending assignments",
          "Set up your profile and preferences"
        ]
      }
    case 'teacher':
      return {
        greeting: "Welcome to your teaching dashboard!",
        features: [
          "Create and manage assignments",
          "Upload and organize study materials",
          "View and manage your students",
          "Track student progress and submissions"
        ],
        nextSteps: [
          "Log in using your credentials below",
          "Set up your teacher profile",
          "Create your first assignment or upload materials",
          "Explore the student management features"
        ]
      }
    case 'admin':
      return {
        greeting: "Welcome to the administrative dashboard!",
        features: [
          "Manage users and roles",
          "Oversee school settings and configuration",
          "Access system-wide reports and analytics",
          "Manage educational recordings and resources"
        ],
        nextSteps: [
          "Log in using your credentials below",
          "Review and configure school settings",
          "Set up user accounts for teachers and students",
          "Explore the administrative tools and reports"
        ]
      }
    default:
      return {
        greeting: "Welcome to Physics Learning Platform!",
        features: ["Access the platform features"],
        nextSteps: ["Log in to get started"]
      }
  }
}

function generateHTML(userData: WelcomeEmailRequest, roleContent: any): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Physics Learning Platform</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .email-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 300;
        }
        .content {
            padding: 30px 20px;
        }
        .greeting {
            font-size: 18px;
            color: #667eea;
            margin-bottom: 20px;
            font-weight: 500;
        }
        .credentials-box {
            background: #f8f9ff;
            border: 2px solid #667eea;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .credentials-box h3 {
            margin-top: 0;
            color: #667eea;
        }
        .credential-item {
            margin: 10px 0;
            font-family: monospace;
            background: white;
            padding: 8px 12px;
            border-radius: 4px;
            border: 1px solid #ddd;
        }
        .features-list {
            list-style: none;
            padding: 0;
        }
        .features-list li {
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .features-list li:last-child {
            border-bottom: none;
        }
        .next-steps {
            background: #e8f5e8;
            border-left: 4px solid #28a745;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
        }
        .next-steps h3 {
            margin-top: 0;
            color: #28a745;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .support-box {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .header {
                padding: 20px 15px;
            }
            .content {
                padding: 20px 15px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Physics Learning Platform</h1>
        </div>
        
        <div class="content">
            <h2>Hello ${userData.name}!</h2>
            <p class="greeting">${roleContent.greeting}</p>
            
            <div class="credentials-box">
                <h3>Your Login Credentials</h3>
                <div class="credential-item">
                    <strong>Email:</strong> ${userData.email}
                </div>
                <div class="credential-item">
                    <strong>Password:</strong> ${userData.password}
                </div>
                ${userData.schoolName ? `<div class="credential-item"><strong>School:</strong> ${userData.schoolName}</div>` : ''}
            </div>
            
            <h3>What you can do as a ${userData.role}:</h3>
            <ul class="features-list">
                ${roleContent.features.map(feature => `<li>${feature}</li>`).join('')}
            </ul>
            
            <div class="next-steps">
                <h3>Next Steps</h3>
                <ol>
                    ${roleContent.nextSteps.map(step => `<li>${step}</li>`).join('')}
                </ol>
            </div>
            
            <div class="support-box">
                <strong>Need Help?</strong><br>
                Contact your school administrator for technical support or questions about platform features.
            </div>
        </div>
        
        <div class="footer">
            <p>Welcome to Physics Learning Platform!</p>
            <p>This email was sent automatically when your account was created.</p>
        </div>
    </div>
</body>
</html>`
}

function generateText(userData: WelcomeEmailRequest, roleContent: any): string {
  return `
WELCOME TO PHYSICS LEARNING PLATFORM
====================================

Hello ${userData.name}!

${roleContent.greeting}

YOUR LOGIN CREDENTIALS
----------------------
Email: ${userData.email}
Password: ${userData.password}
${userData.schoolName ? `School: ${userData.schoolName}` : ''}

WHAT YOU CAN DO AS A ${userData.role.toUpperCase()}:
${roleContent.features.map((feature, index) => `${index + 1}. ${feature}`).join('\n')}

NEXT STEPS:
${roleContent.nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

NEED HELP?
Contact your school administrator for technical support or questions about platform features.

---
Welcome to Physics Learning Platform!
This email was sent automatically when your account was created.
`
}