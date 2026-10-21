import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { getCurrentUser } from '../../lib/auth';
import { getMessagesByClass, createMessage } from '../../lib/database';
import { formatRelativeDate, formatFileSize, handleError, showSuccess } from '../../lib/utils';
import { notifyNewMessageToClass } from '../../lib/notifications';
import { supabase } from '../../lib/supabase';
import AnimatedCard from '../../components/AnimatedCard';
import FadeInView from '../../components/FadeInView';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Colors } from '../../constants/Colors';
import { Spacing } from '../../constants/Styles';

interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender?: {
    id: string;
    name: string;
    role: string;
  };
  attachments?: any[];
  reactions?: { [emoji: string]: string[] };
  read_by?: string[];
  message_type?: string;
  file_url?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
}

export default function StudentChat() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedSchool && user) {
      loadMessages();
      setupRealtimeSubscription();
    }
  }, [selectedSchool, user]);

  const setupRealtimeSubscription = () => {
    if (!selectedSchool) return;

    const subscription = supabase
      .channel(`messages-${selectedSchool}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `school_id=eq.${selectedSchool}`,
        },
        async (payload) => {
          const newMessage = payload.new;
          
          // Don't reload for our own messages (they're already added optimistically)
          if (newMessage.sender_id !== user?.id) {
            // Reload messages to get complete data with sender info
            await loadMessages();
            
            // Show browser notification if page is not focused
            if (typeof document !== 'undefined' && document.hidden) {
              showBrowserNotification(
                'New Message',
                `Someone: ${newMessage.content}`,
                () => {
                  window.focus();
                }
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  };

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;
      
      setUser(currentUser);

      // Check if school was passed as parameter (for admin/teacher school selection)
      if (params.schoolId) {
        setSelectedSchool(params.schoolId as string);
        const schoolName = params.schoolName as string || 'School Chat';
        setSchools([{ id: params.schoolId, name: schoolName }]);
      } else if (currentUser.role === 'student') {
        // Students use their assigned school
        if (currentUser.school_id) {
          setSelectedSchool(currentUser.school_id);
          const { data: schoolData } = await supabase
            .from('schools')
            .select('name')
            .eq('id', currentUser.school_id)
            .single();
          
          const schoolName = schoolData?.name || 'School Chat';
          setSchools([{ id: currentUser.school_id, name: `${schoolName} Chat` }]);
        }
      } else if (currentUser.role === 'teacher' || currentUser.role === 'admin') {
        // Teachers and admins need to choose a school first
        if (!params.schoolId) {
          router.push('/school-chooser');
          return;
        }
      }
    } catch (error) {
      console.error('Load data error:', error);
      handleError(error, 'Failed to load chat data');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!selectedSchool) return;
    
    try {
      const { data: messagesData } = await getMessagesByClass(selectedSchool);
      if (messagesData) {
        // Reverse the order so oldest messages are at top, newest at bottom
        const sortedMessages = messagesData.sort((a: any, b: any) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setMessages(sortedMessages);
        // Scroll to bottom after loading messages
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedSchool || sending) return;

    const messageContent = newMessage.trim();
    const tempId = Date.now().toString();
    
    // Optimistically add message to UI
    const optimisticMessage = {
      id: tempId,
      content: messageContent,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      sender: { id: user.id, name: user.name, role: user.role },
      school_id: selectedSchool,
      message_type: 'message',
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    
    // Scroll to bottom immediately
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 50);

    setSending(true);
    try {
      const messageData = {
        school_id: selectedSchool,
        sender_id: user.id,
        content: messageContent,
        message_type: 'message',
      };

      const { data, error } = await createMessage(messageData);
      
      if (error) {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setNewMessage(messageContent); // Restore message
        handleError(error, 'Failed to send message');
      } else {
        // Replace optimistic message with real one
        setMessages(prev => prev.map(m => 
          m.id === tempId ? { ...data, sender: optimisticMessage.sender } : m
        ));
      }
    } catch (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(messageContent); // Restore message
      handleError(error, 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const showBrowserNotification = (title: string, body: string, onClick?: () => void) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'chat-message',
      });
      
      if (onClick) {
        notification.onclick = onClick;
      }
      
      setTimeout(() => notification.close(), 5000);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const isVideo = asset.type === 'video' || asset.mimeType?.startsWith('video/') || asset.uri?.endsWith('.mp4');
        await uploadAndSendFile(asset, isVideo ? 'video' : 'image');
      }
    } catch (error) {
      handleError(error, 'Failed to pick media');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadAndSendFile(result.assets[0], 'document');
      }
    } catch (error) {
      handleError(error, 'Failed to pick document');
    }
  };

  const uploadAndSendFile = async (file: any, type: 'image' | 'video' | 'document') => {
    if (!selectedSchool || !user) return;

    const MAX_CHAT_FILE_SIZE = 30 * 1024 * 1024; // 30MB strict limit

    if (file.size && file.size > MAX_CHAT_FILE_SIZE) {
      Alert.alert('File Too Large', 'Upload limit in chat is 30MB. Please choose a smaller file.');
      return;
    }

    setSending(true);
    try {
      // Read file as blob
      const response = await fetch(file.uri);
      const blob = await response.blob();

      if (blob.size > MAX_CHAT_FILE_SIZE) {
        Alert.alert('File Too Large', 'Upload limit in chat is 30MB. Please choose a smaller file.');
        return;
      }
      
      // Create unique filename
      const defaultExt = type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'pdf';
      const fileExt = file.name?.split('.').pop() || defaultExt;
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `chat/${selectedSchool}/${fileName}`;

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('chat-files')
        .upload(filePath, blob, {
          contentType: file.mimeType || (type === 'image' ? 'image/jpeg' : type === 'video' ? 'video/mp4' : 'application/octet-stream'),
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      // Send message with file attachment
      const messageData = {
        content: type === 'image' ? '[Image]' : type === 'video' ? '[Video]' : `[File] ${file.name || 'Document'}`,
        sender_id: user.id,
        school_id: selectedSchool,
        message_type: type,
        file_path: filePath,
        file_url: urlData.publicUrl,
        file_name: file.name || fileName,
        file_size: file.size || blob.size
      };

      const { data: messageResult, error: messageError } = await supabase
        .from('messages')
        .insert(messageData)
        .select(`
          *,
          sender:app_users!messages_sender_id_fkey(id, name, role)
        `)
        .single();

      if (messageError) throw messageError;

      // Add to local messages
      setMessages(prev => [...prev, messageResult]);
      
      showSuccess(`${type === 'image' ? 'Image' : 'Document'} sent successfully!`);
      
      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('File upload error:', error);
      handleError(error, `Failed to send ${type}`);
    } finally {
      setSending(false);
    }
  };

  const isMyMessage = (message: ChatMessage) => {
    return message.sender_id === user?.id;
  };

  const addReaction = async (messageId: string, emoji: string) => {
    try {
      // In a real implementation, you'd update the message reactions in the database
      // For now, we'll just show a success message
      // Reaction added successfully
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const getReactionCount = (message: ChatMessage, emoji: string) => {
    return message.reactions?.[emoji]?.length || 0;
  };

  const hasUserReacted = (message: ChatMessage, emoji: string) => {
    return message.reactions?.[emoji]?.includes(user?.id) || false;
  };

  const isMessageRead = (message: ChatMessage) => {
    return message.read_by?.includes(user?.id) || false;
  };

  const getSelectedSchoolName = () => {
    const selectedSchoolObj = schools.find(s => s.id === selectedSchool);
    return selectedSchoolObj ? selectedSchoolObj.name : 'Select School';
  };

  const getChatTitle = () => {
    if (user?.role === 'student') {
      return 'Chat with Teachers';
    } else if (user?.role === 'teacher') {
      return 'School Chat';
    } else if (user?.role === 'admin') {
      return 'School Chat';
    }
    return 'Chat';
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);
      
      if (error) {
        handleError(error, 'Failed to delete message');
      } else {
        showSuccess('Message deleted');
        loadMessages(); // Reload messages
      }
    } catch (error) {
      handleError(error, 'Failed to delete message');
    }
  };

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(null);

  const handleMessageLongPress = (message: ChatMessage) => {
    const isMyMessage = message.sender_id === user?.id;
    const canDeleteAny = user?.role === 'teacher' || user?.role === 'admin';
    const canDelete = isMyMessage || canDeleteAny;
    
    if (!canDelete) return;

    setMessageToDelete(message);
    setShowDeleteDialog(true);
  };

  const confirmDeleteMessage = () => {
    if (messageToDelete) {
      deleteMessage(messageToDelete.id);
    }
    setShowDeleteDialog(false);
    setMessageToDelete(null);
  };

  const cancelDeleteMessage = () => {
    setShowDeleteDialog(false);
    setMessageToDelete(null);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with School Selector */}
      <FadeInView style={styles.header}>
        <View style={styles.headerTop}>
          {(user?.role === 'teacher' || user?.role === 'admin') && (
            <TouchableOpacity onPress={() => router.push('/school-chooser')}>
              <Ionicons name="arrow-back" size={24} color={Colors.primary} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{getChatTitle()}</Text>
          <View style={{ width: 24 }} />
        </View>
        {schools.length > 0 && (
          <View style={styles.schoolInfo}>
            <Ionicons name="school" size={16} color={Colors.primary} />
            <Text style={styles.schoolName}>{getSelectedSchoolName()}</Text>
          </View>
        )}
      </FadeInView>

      {!selectedSchool ? (
        <EmptyState
          icon="chatbubbles"
          message="Loading chat..."
        />
      ) : (
        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Messages */}
          <ScrollView 
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
          >
            {/* Typing Indicator */}
            {typing.length > 0 && (
              <View style={styles.typingIndicator}>
                <Text style={styles.typingText}>
                  {typing.join(', ')} {typing.length === 1 ? 'is' : 'are'} typing...
                </Text>
              </View>
            )}
            {messages.length === 0 ? (
              <EmptyState
                icon="chatbubbles"
                message="No messages yet. Start a conversation with your teacher!"
              />
            ) : (
              messages.map((message, index) => (
                <TouchableOpacity
                  key={message.id}
                  onLongPress={() => handleMessageLongPress(message)}
                  activeOpacity={0.8}
                >
                  <AnimatedCard 
                    style={isMyMessage(message) 
                      ? { ...styles.messageCard, ...styles.myMessage }
                      : { ...styles.messageCard, ...styles.theirMessage }
                    }
                    delay={index * 50}
                  >
                    <View style={styles.messageHeader}>
                      <View style={styles.senderWithBadge}>
                        <Text style={styles.senderName}>
                          {isMyMessage(message) ? 'You' : message.sender?.name || (message.sender?.role === 'teacher' ? 'Teacher' : 'Student')}
                        </Text>
                        <View style={[
                          styles.roleBadge,
                          {
                            backgroundColor: (message.sender?.role || (isMyMessage(message) ? user?.role : 'student')) === 'teacher' ? '#E0F2FE' : '#DCFCE7'
                          }
                        ]}>
                          <Text style={[
                            styles.roleBadgeText,
                            {
                              color: (message.sender?.role || (isMyMessage(message) ? user?.role : 'student')) === 'teacher' ? '#0369A1' : '#15803D'
                            }
                          ]}>
                            {(message.sender?.role || (isMyMessage(message) ? user?.role : 'student')) === 'teacher' ? 'Teacher' : 'Student'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.messageTime}>
                        {formatRelativeDate(message.created_at)}
                      </Text>
                    </View>
                    {/* Display image if message is an image */}
                    {message.message_type === 'image' && message.file_url && (
                      <TouchableOpacity onPress={() => message.file_url && Linking.openURL(message.file_url)}>
                        <Image 
                          source={{ uri: message.file_url }} 
                          style={styles.messageImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    )}

                    {/* Display video if message is a video */}
                    {message.message_type === 'video' && message.file_url && (
                      <TouchableOpacity 
                        style={styles.fileAttachment}
                        onPress={() => message.file_url && Linking.openURL(message.file_url)}
                      >
                        <View style={[styles.fileIcon, { backgroundColor: '#FEF3C7' }]}>
                          <Ionicons name="videocam" size={24} color="#D97706" />
                        </View>
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName} numberOfLines={1}>
                            {message.file_name || 'Video attachment'}
                          </Text>
                          {message.file_size && (
                            <Text style={styles.fileSize}>
                              {formatFileSize(message.file_size)}
                            </Text>
                          )}
                        </View>
                        <Ionicons name="play-circle" size={24} color={Colors.primary} />
                      </TouchableOpacity>
                    )}
                    
                    {/* Display file attachment if message is a document */}
                    {message.message_type === 'document' && message.file_url && (
                      <TouchableOpacity 
                        style={styles.fileAttachment}
                        onPress={() => message.file_url && Linking.openURL(message.file_url)}
                      >
                        <View style={styles.fileIcon}>
                          <Ionicons name="document" size={24} color={Colors.primary} />
                        </View>
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName} numberOfLines={1}>
                            {message.file_name || 'Document'}
                          </Text>
                          {message.file_size && (
                            <Text style={styles.fileSize}>
                              {formatFileSize(message.file_size)}
                            </Text>
                          )}
                        </View>
                        <Ionicons name="download-outline" size={20} color={Colors.primary} />
                      </TouchableOpacity>
                    )}
                    
                    {/* Display text content only if not just an attachment indicator */}
                    {message.content && !message.content.startsWith('[Image]') && !message.content.startsWith('[Video]') && !message.content.startsWith('[File]') && !message.content.startsWith('📷') && !message.content.startsWith('🎥') && !message.content.startsWith('📄') && (
                      <Text style={[
                        styles.messageContent,
                        { color: isMyMessage(message) ? Colors.text.inverse : Colors.text.primary }
                      ]}>
                        {message.content}
                      </Text>
                    )}

                    {/* Read Receipt */}
                    {isMyMessage(message) && (
                      <View style={styles.readReceipt}>
                        <Ionicons 
                          name={isMessageRead(message) ? "checkmark-done" : "checkmark"} 
                          size={12} 
                          color={isMessageRead(message) ? Colors.info : Colors.text.tertiary} 
                        />
                      </View>
                    )}
                  </AnimatedCard>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Admin Read Only Banner vs Message Input */}
          {user?.role === 'admin' ? (
            <View style={styles.adminReadOnlyContainer}>
              <Ionicons name="eye" size={20} color={Colors.info} />
              <Text style={styles.adminReadOnlyText}>
                Admin View Only: You can monitor this chat, but typing is disabled.
              </Text>
            </View>
          ) : (
            <View style={styles.inputContainer}>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.messageInput}
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Type your message..."
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity 
                  style={styles.attachButton}
                  onPress={pickImage}
                >
                  <Ionicons name="image" size={20} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.attachButton}
                  onPress={pickDocument}
                >
                  <Ionicons name="document" size={20} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
                  onPress={sendMessage}
                  disabled={!newMessage.trim() || sending}
                >
                  <Ionicons 
                    name={sending ? "hourglass" : "send"} 
                    size={20} 
                    color={Colors.text.inverse} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      <ConfirmDialog
        visible={showDeleteDialog}
        title="Delete Message"
        message={
          messageToDelete?.sender_id === user?.id
            ? "Are you sure you want to delete your message?"
            : "Are you sure you want to delete this message? This action cannot be undone."
        }
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteMessage}
        onCancel={cancelDeleteMessage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.card.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  schoolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  schoolName: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    marginLeft: Spacing.sm,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    padding: Spacing.lg,
  },
  messagesContent: {
    paddingBottom: Spacing.lg,
  },
  messageCard: {
    marginBottom: Spacing.md,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.card.background,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  senderWithBadge: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  messageTime: {
    fontSize: 10,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  roleBadgeText: {
    fontSize: 10,
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  inputContainer: {
    backgroundColor: Colors.card.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    padding: Spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxHeight: 100,
    fontSize: 14,
    color: Colors.text.primary,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.medium,
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
    backgroundColor: Colors.text.tertiary,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  reactionButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  reactionButtonHidden: {
    opacity: 0.3,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    color: Colors.text.secondary,
    marginLeft: 2,
    fontWeight: '600',
  },
  reactionCountActive: {
    color: Colors.text.inverse,
  },
  addReactionButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readReceipt: {
    alignSelf: 'flex-end',
    marginTop: Spacing.xs,
  },
  typingIndicator: {
    padding: Spacing.md,
    alignSelf: 'flex-start',
  },
  typingText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  fileSize: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  adminReadOnlyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.card.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    gap: 8,
  },
  adminReadOnlyText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.info,
  },
});