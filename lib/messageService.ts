import { supabase } from './supabase';
import { getCurrentUser } from './auth';

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  content: string;
  is_read: boolean;
  school_id: string;
  created_at: string;
  sender?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
  recipient?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
}

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
  messageId: string
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
  messageId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

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