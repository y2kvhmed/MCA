import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { handleError, showSuccess, formatFileSize } from '../lib/utils';
import { hapticFeedback } from '../lib/haptics';
import LoadingSpinner from '../components/LoadingSpinner';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function SchoolChat() {
  const router = useRouter();
  const { schoolId, schoolName } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const activeSchoolId = (schoolId as string) || user?.school_id;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeSchoolId) {
      const subscription = subscribeToMessages();
      return () => {
        subscription?.unsubscribe();
      };
    }
  }, [activeSchoolId]);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.replace('/login');
        return;
      }
      setUser(currentUser);
      await loadMessages((schoolId as string) || currentUser.school_id || '');
    } catch (error) {
      handleError(error, 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (targetSchoolId?: string) => {
    if (!targetSchoolId) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:app_users!messages_sender_id_fkey(id, name, role)
        `)
        .eq('school_id', targetSchoolId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const subscribeToMessages = () => {
    if (!activeSchoolId) return null;
    return supabase
      .channel(`school-chat-${activeSchoolId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `school_id=eq.${activeSchoolId}`,
      }, () => {
        loadMessages(activeSchoolId);
      })
      .subscribe();
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !activeSchoolId) return;

    setSending(true);
    try {
      hapticFeedback.light();
      
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          school_id: activeSchoolId,
          content: newMessage.trim(),
          message_type: 'text',
        });

      if (error) throw error;

      setNewMessage('');
      hapticFeedback.success();
    } catch (error) {
      hapticFeedback.error();
      handleError(error, 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const pickMedia = async () => {
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
    if (!activeSchoolId || !user) return;

    const MAX_CHAT_FILE_SIZE = 30 * 1024 * 1024; // 30MB limit

    if (file.size && file.size > MAX_CHAT_FILE_SIZE) {
      Alert.alert('File Too Large', 'Upload limit is 30MB. Please select a smaller file.');
      return;
    }

    setSending(true);
    try {
      const response = await fetch(file.uri);
      const blob = await response.blob();

      if (blob.size > MAX_CHAT_FILE_SIZE) {
        Alert.alert('File Too Large', 'Upload limit is 30MB. Please select a smaller file.');
        return;
      }

      const defaultExt = type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'pdf';
      const fileExt = file.name?.split('.').pop() || defaultExt;
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `chat/${activeSchoolId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, blob, {
          contentType: file.mimeType || (type === 'image' ? 'image/jpeg' : type === 'video' ? 'video/mp4' : 'application/octet-stream'),
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      const messageData = {
        content: type === 'image' ? '[Image]' : type === 'video' ? '[Video]' : `[File] ${file.name || 'Document'}`,
        sender_id: user.id,
        school_id: activeSchoolId,
        message_type: type,
        file_path: filePath,
        file_url: urlData.publicUrl,
        file_name: file.name || fileName,
        file_size: file.size || blob.size,
      };

      const { error: messageError } = await supabase
        .from('messages')
        .insert(messageData);

      if (messageError) throw messageError;

      showSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} sent!`);
      await loadMessages(activeSchoolId);
    } catch (error) {
      console.error('File upload error:', error);
      handleError(error, `Failed to send ${type}`);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {schoolName ? decodeURIComponent(schoolName as string) : 'School Chat'}
          </Text>
          <Text style={styles.headerSubtitle}>Community Discussion</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message) => {
            const isOwnMessage = message.sender_id === user?.id;
            const senderRole = message.sender?.role || (isOwnMessage ? user?.role : 'student');
            return (
              <View
                key={message.id}
                style={[
                  styles.messageWrapper,
                  isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper,
                ]}
              >
                {!isOwnMessage && (
                  <View style={styles.senderInfo}>
                    <Text style={styles.senderName}>{message.sender?.name || 'Unknown'}</Text>
                    <View style={[
                      styles.roleBadge,
                      { backgroundColor: senderRole === 'teacher' ? '#E0F2FE' : '#DCFCE7' }
                    ]}>
                      <Text style={[
                        styles.roleBadgeText,
                        { color: senderRole === 'teacher' ? '#0369A1' : '#15803D' }
                      ]}>
                        {senderRole === 'teacher' ? 'Teacher' : 'Student'}
                      </Text>
                    </View>
                  </View>
                )}

                <View
                  style={[
                    styles.messageBubble,
                    isOwnMessage ? styles.ownMessage : styles.otherMessage,
                  ]}
                >
                  {/* Image attachment */}
                  {message.message_type === 'image' && message.file_url && (
                    <TouchableOpacity onPress={() => Linking.openURL(message.file_url)}>
                      <Image source={{ uri: message.file_url }} style={styles.chatImage} resizeMode="cover" />
                    </TouchableOpacity>
                  )}

                  {/* Video attachment */}
                  {message.message_type === 'video' && message.file_url && (
                    <TouchableOpacity 
                      style={styles.attachmentBox}
                      onPress={() => Linking.openURL(message.file_url)}
                    >
                      <Ionicons name="play-circle" size={28} color={isOwnMessage ? Colors.text.inverse : Colors.warning} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.attachmentName, isOwnMessage && styles.ownMessageText]} numberOfLines={1}>
                          {message.file_name || 'Video'}
                        </Text>
                        {message.file_size && (
                          <Text style={[styles.attachmentSize, isOwnMessage && { color: Colors.text.inverse, opacity: 0.8 }]}>
                            {formatFileSize(message.file_size)}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Document attachment */}
                  {message.message_type === 'document' && message.file_url && (
                    <TouchableOpacity 
                      style={styles.attachmentBox}
                      onPress={() => Linking.openURL(message.file_url)}
                    >
                      <Ionicons name="document-attach" size={24} color={isOwnMessage ? Colors.text.inverse : Colors.primary} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.attachmentName, isOwnMessage && styles.ownMessageText]} numberOfLines={1}>
                          {message.file_name || 'Document'}
                        </Text>
                        {message.file_size && (
                          <Text style={[styles.attachmentSize, isOwnMessage && { color: Colors.text.inverse, opacity: 0.8 }]}>
                            {formatFileSize(message.file_size)}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}

                  {message.content && !message.content.startsWith('[Image]') && !message.content.startsWith('[Video]') && !message.content.startsWith('[File]') && !message.content.startsWith('📷') && !message.content.startsWith('🎥') && !message.content.startsWith('📄') && (
                    <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
                      {message.content}
                    </Text>
                  )}

                  <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Admin View-Only Mode vs Input */}
        {user?.role === 'admin' ? (
          <View style={styles.adminReadOnlyContainer}>
            <Ionicons name="eye" size={20} color={Colors.info} />
            <Text style={styles.adminReadOnlyText}>
              Admin View Only: You can monitor school chat, but typing is disabled.
            </Text>
          </View>
        ) : (
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
            <TouchableOpacity style={styles.attachBtn} onPress={pickMedia}>
              <Ionicons name="image" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachBtn} onPress={pickDocument}>
              <Ionicons name="attach" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || sending}
            >
              <Ionicons name="send" size={18} color={Colors.text.inverse} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, backgroundColor: Colors.card.background,
    borderBottomWidth: 1, borderBottomColor: Colors.border.light,
  },
  headerInfo: { flex: 1, marginLeft: Spacing.md },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
  headerSubtitle: { fontSize: 12, color: Colors.text.secondary },
  content: { flex: 1 },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: Spacing.md },
  messageWrapper: { marginBottom: Spacing.md, maxWidth: '82%' },
  ownMessageWrapper: { alignSelf: 'flex-end' },
  otherMessageWrapper: { alignSelf: 'flex-start' },
  senderInfo: { flexDirection: 'column', alignItems: 'flex-start', gap: 2, marginBottom: 4, marginLeft: Spacing.xs },
  senderName: { fontSize: 12, fontWeight: '700', color: Colors.text.primary },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700' },
  messageBubble: { borderRadius: 16, padding: Spacing.md },
  ownMessage: { backgroundColor: Colors.primary },
  otherMessage: { backgroundColor: Colors.card.background, borderWidth: 1, borderColor: Colors.border.light },
  messageText: { fontSize: 14, color: Colors.text.primary, lineHeight: 20 },
  ownMessageText: { color: Colors.text.inverse },
  messageTime: { fontSize: 10, color: Colors.text.tertiary, marginTop: 4, alignSelf: 'flex-end' },
  ownMessageTime: { color: Colors.text.inverse, opacity: 0.75 },
  chatImage: { width: 220, height: 160, borderRadius: 10, marginBottom: 6 },
  attachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  attachmentName: { fontSize: 13, fontWeight: '600', color: Colors.text.primary },
  attachmentSize: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },
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
  adminReadOnlyText: { fontSize: 13, fontWeight: '600', color: Colors.info },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
    backgroundColor: Colors.card.background, borderTopWidth: 1, borderTopColor: Colors.border.light,
  },
  input: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 20,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 14, color: Colors.text.primary, maxHeight: 100,
    marginRight: Spacing.xs,
  },
  attachBtn: {
    padding: 8,
  },
  sendButton: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.xs,
  },
  sendButtonDisabled: { opacity: 0.4 },
});
