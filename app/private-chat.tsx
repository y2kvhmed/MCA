import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getPrivateMessagesWithUser, sendPrivateMessage } from '../lib/database';
import { handleError, showSuccess } from '../lib/utils';
import { hapticFeedback } from '../lib/haptics';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type: string;
  created_at: string;
  sender?: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
  recipient?: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
}

export default function PrivateChat() {
  const router = useRouter();
  const { otherUserId, studentId } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadData();
    const subscription = subscribeToMessages();
    return () => {
      subscription?.unsubscribe();
    };
  }, [otherUserId]);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.replace('/login');
        return;
      }
      setUser(currentUser);

      // Get other user details
      const { data: otherUserData } = await supabase
        .from('app_users')
        .select('*, linked_student:app_users!app_users_linked_student_id_fkey(id, name, email)')
        .eq('id', otherUserId)
        .single();

      if (otherUserData) {
        setOtherUser(otherUserData);
        if (otherUserData.linked_student) {
          setStudent(otherUserData.linked_student);
        } else if (studentId) {
          const { data: studentData } = await supabase
            .from('app_users')
            .select('id, name, email')
            .eq('id', studentId)
            .single();
          setStudent(studentData);
        }
      }

      await loadMessages();
    } catch (error) {
      handleError(error, 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!otherUserId || !user) return;
    
    try {
      const { data, error } = await getPrivateMessagesWithUser(user.id, otherUserId as string);
      if (error) throw error;
      setMessages(data || []);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const subscribeToMessages = () => {
    if (!otherUserId) return null;
    
    return supabase
      .channel(`private-chat-${user?.id}-${otherUserId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'private_messages',
        filter: `or(and(sender_id.eq.${user?.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user?.id}))`,
      }, () => {
        loadMessages();
      })
      .subscribe();
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !otherUserId) return;

    setSending(true);
    try {
      hapticFeedback.light();
      
      const { data, error } = await sendPrivateMessage({
        sender_id: user.id,
        recipient_id: otherUserId as string,
        content: newMessage.trim(),
        message_type: 'text',
      });

      if (error) throw error;

      setNewMessage('');
      hapticFeedback.success();
      await loadMessages();
    } catch (error) {
      hapticFeedback.error();
      handleError(error, 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const getHeaderTitle = () => {
    return otherUser?.name || 'Chat';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
          {student && (
            <Text style={styles.headerSubtitle}>Student: {student.name}</Text>
          )}
        </View>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          ) : (
            messages.map((message) => {
              const isMe = message.sender_id === user?.id;
              return (
                <View
                  key={message.id}
                  style={[
                    styles.messageContainer,
                    isMe ? styles.myMessage : styles.theirMessage,
                  ]}
                >
                  <Text style={[
                    styles.messageText,
                    isMe ? styles.myMessageText : styles.theirMessageText,
                  ]}>
                    {message.content}
                  </Text>
                  <Text style={[
                    styles.messageTime,
                    isMe ? styles.myMessageTime : styles.theirMessageTime,
                  ]}>
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={Colors.text.tertiary}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            <Ionicons
              name="send"
              size={20}
              color={newMessage.trim() ? Colors.text.inverse : Colors.text.tertiary}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.card.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: Spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
  messageContainer: {
    maxWidth: '75%',
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 16,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.card.background,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: Colors.text.inverse,
  },
  theirMessageText: {
    color: Colors.text.primary,
  },
  messageTime: {
    fontSize: 11,
    marginTop: Spacing.xs,
  },
  myMessageTime: {
    color: Colors.text.inverse + 'CC',
  },
  theirMessageTime: {
    color: Colors.text.tertiary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.md,
    backgroundColor: Colors.card.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: 20,
    fontSize: 15,
    color: Colors.text.primary,
    marginRight: Spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.border.medium,
  },
});



