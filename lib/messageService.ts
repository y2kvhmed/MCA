import { supabase } from './supabase';

// Message types
export interface Message {
  id: string;
  sender_id: string;
  recipient_id?: string;
  class_id?: string;
  subject?: string;
  content: string;
  is_read?: boolean;
  message_type?: 'direct' | 'class' | 'announcement';
  school_id?: string;
  created_at: string;
  sender?: {
    id?: string;
    full_name?: string;
    name?: string;
    email?: string;
    role?: string;
  };
  recipient?: {
    id?: string;
    full_name?: string;
    email?: string;
    role?: string;
  };
}

// Enhanced logging
const logMessage = (operation: string, data?: any) => {
  if (__DEV__) {
    console.log(`[MESSAGE] ${operation}:`, data || '');
  }
};
import { getCurrentUser } from './auth';

// Send a message
export const sendMessage = async (
  recipientId: string,
  subject: string,
  content: string
): Promise<{ success: boolean; error?: string; messageId?: string }> => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    console.log('Sending message:', { recipientId, subject, content, senderId: currentUser.id });

    const messageData = {
      sender_id: currentUser.id,
      recipient_id: recipientId,
      subject: subject.trim(),
      content: content.trim(),
      is_read: false,
      school_id: currentUser.school_id,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select('id')
      .single();

    if (error) {
      console.error('Message send error:', error);
      return { success: false, error: error.message };
    }

    console.log('Message sent successfully:', data);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Send message exception:', error);
    return { success: false, error: 'Failed to send message' };
  }
};

// Get messages for current user
export const getMessages = async (
  type: 'inbox' | 'sent' = 'inbox'
): Promise<{ success: boolean; data?: Message[]; error?: string }> => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    const column = type === 'inbox' ? 'recipient_id' : 'sender_id';
    const otherColumn = type === 'inbox' ? 'sender_id' : 'recipient_id';

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:app_users!messages_sender_id_fkey(id, full_name, email, role),
        recipient:app_users!messages_recipient_id_fkey(id, full_name, email, role)
      `)
      .eq(column, currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get messages error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get messages exception:', error);
    return { success: false, error: 'Failed to get messages' };
  }
};

// Mark message as read
export const markMessageAsRead = async (
  messageId: string,
  _userId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('id', messageId);

    if (error) {
      console.error('Mark as read error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Mark as read exception:', error);
    return { success: false, error: 'Failed to mark message as read' };
  }
};

// Get unread message count
export const getUnreadCount = async (): Promise<{ success: boolean; count?: number; error?: string }> => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data, error, count } = await supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('recipient_id', currentUser.id)
      .eq('is_read', false);

    if (error) {
      console.error('Get unread count error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, count: count || 0 };
  } catch (error) {
    console.error('Get unread count exception:', error);
    return { success: false, error: 'Failed to get unread count' };
  }
};

// Delete message
export const deleteMessage = async (
  messageId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    let query = supabase.from('messages').delete().eq('id', messageId);
    if (userId) {
      query = query.eq('sender_id', userId);
    }
    const { error } = await query;

    if (error) {
      console.error('Delete message error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete message exception:', error);
    return { success: false, error: 'Failed to delete message' };
  }
};

// Get all users for messaging (teachers and students in same school)
export const getMessagingUsers = async (): Promise<{ success: boolean; data?: any[]; error?: string }> => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('app_users')
      .select('id, full_name, email, role')
      .eq('school_id', currentUser.school_id)
      .eq('is_active', true)
      .neq('id', currentUser.id)
      .order('full_name');

    if (error) {
      console.error('Get messaging users error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get messaging users exception:', error);
    return { success: false, error: 'Failed to get users' };
  }
};
// Create messages table if it doesn't exist
export async function initializeMessaging() {
  try {
    logMessage('Initializing messaging system');
    
    // Check if messages table exists, if not create it
    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .limit(1);
    
    if (error && error.message.includes('does not exist')) {
      logMessage('Messages table does not exist, creating...');
      
      // Create table via RPC or direct SQL (this might fail due to permissions)
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sender_id UUID REFERENCES app_users(id) NOT NULL,
          recipient_id UUID REFERENCES app_users(id),
          class_id UUID REFERENCES classes(id),
          content TEXT NOT NULL,
          message_type TEXT CHECK (message_type IN ('direct', 'class', 'announcement')) DEFAULT 'direct',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE POLICY "Users can view their messages" ON messages FOR SELECT USING (
          sender_id = auth.uid() OR 
          recipient_id = auth.uid() OR 
          class_id IN (SELECT class_id FROM enrollments WHERE student_id = auth.uid())
        );
        
        CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (
          sender_id = auth.uid()
        );
        
        ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
      `;
      
      // For now, we'll work with what we have and handle the table creation manually
      logMessage('Please create messages table manually in Supabase');
    }
    
    return { success: true };
  } catch (error) {
    logMessage('Initialization failed', error);
    return { success: false, error };
  }
}

// Send a direct message
export async function sendDirectMessage(senderId: string, recipientId: string, content: string) {
  try {
    logMessage('Sending direct message', { senderId, recipientId });
    
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        recipient_id: recipientId,
        content: content,
        message_type: 'direct'
      })
      .select(`
        *,
        sender:app_users!messages_sender_id_fkey(name, role)
      `)
      .single();

    if (error) {
      logMessage('Send direct message failed', error);
      return { data: null, error: error.message };
    }
    
    logMessage('Direct message sent successfully');
    return { data, error: null };
  } catch (error) {
    logMessage('Send direct message error', error);
    return { data: null, error: 'Failed to send message' };
  }
}

// Send a class message
export async function sendClassMessage(senderId: string, classId: string, content: string) {
  try {
    logMessage('Sending class message', { senderId, classId });
    
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        class_id: classId,
        content: content,
        message_type: 'class'
      })
      .select(`
        *,
        sender:app_users!messages_sender_id_fkey(name, role)
      `)
      .single();

    if (error) {
      logMessage('Send class message failed', error);
      return { data: null, error: error.message };
    }
    
    logMessage('Class message sent successfully');
    return { data, error: null };
  } catch (error) {
    logMessage('Send class message error', error);
    return { data: null, error: 'Failed to send message' };
  }
}

// Send an announcement (admin/teacher to all)
export async function sendAnnouncement(senderId: string, content: string, schoolId?: string) {
  try {
    logMessage('Sending announcement', { senderId, schoolId });
    
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        content: content,
        message_type: 'announcement'
      })
      .select(`
        *,
        sender:app_users!messages_sender_id_fkey(name, role)
      `)
      .single();

    if (error) {
      logMessage('Send announcement failed', error);
      return { data: null, error: error.message };
    }
    
    logMessage('Announcement sent successfully');
    return { data, error: null };
  } catch (error) {
    logMessage('Send announcement error', error);
    return { data: null, error: 'Failed to send announcement' };
  }
}

// Get messages for a user
export async function getMessagesForUser(userId: string, messageType?: 'direct' | 'class' | 'announcement') {
  try {
    logMessage('Fetching messages for user', { userId, messageType });
    
    let query = supabase
      .from('messages')
      .select(`
        *,
        sender:app_users!messages_sender_id_fkey(name, role),
        recipient:app_users!messages_recipient_id_fkey(name, role),
        class:classes(name)
      `)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (messageType) {
      query = query.eq('message_type', messageType);
    }

    const { data, error } = await query;

    if (error) {
      logMessage('Get messages failed', error);
      return { data: null, error: error.message };
    }
    
    logMessage('Messages fetched successfully', data?.length);
    return { data, error: null };
  } catch (error) {
    logMessage('Get messages error', error);
    return { data: null, error: 'Failed to fetch messages' };
  }
}

// Get class messages
export async function getClassMessages(classId: string) {
  try {
    logMessage('Fetching class messages', classId);
    
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:app_users!messages_sender_id_fkey(name, role)
      `)
      .eq('class_id', classId)
      .eq('message_type', 'class')
      .order('created_at', { ascending: false });

    if (error) {
      logMessage('Get class messages failed', error);
      return { data: null, error: error.message };
    }
    
    logMessage('Class messages fetched successfully', data?.length);
    return { data, error: null };
  } catch (error) {
    logMessage('Get class messages error', error);
    return { data: null, error: 'Failed to fetch class messages' };
  }
}

// Get announcements
export async function getAnnouncements(limit: number = 10) {
  try {
    logMessage('Fetching announcements');
    
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:app_users!messages_sender_id_fkey(name, role)
      `)
      .eq('message_type', 'announcement')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logMessage('Get announcements failed', error);
      return { data: null, error: error.message };
    }
    
    logMessage('Announcements fetched successfully', data?.length);
    return { data, error: null };
  } catch (error) {
    logMessage('Get announcements error', error);
    return { data: null, error: 'Failed to fetch announcements' };
  }
}



// Real-time message subscription
export function subscribeToMessages(userId: string, callback: (message: Message) => void) {
  logMessage('Setting up real-time subscription', userId);
  
  const subscription = supabase
    .channel('messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${userId}`
      },
      (payload) => {
        logMessage('New message received', payload.new);
        callback(payload.new as Message);
      }
    )
    .subscribe();

  return subscription;
}

// Initialize messaging on module load
initializeMessaging();