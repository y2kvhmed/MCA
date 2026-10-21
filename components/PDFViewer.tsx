import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import { supabase } from '../lib/supabase';

interface PDFViewerProps {
  filePath?: string;
  fileUrl?: string;
  fileName?: string;
  onClose?: () => void;
}

export default function PDFViewer({ filePath, fileUrl, fileName, onClose }: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    loadPdfUrl();
  }, [filePath, fileUrl]);

  const loadPdfUrl = async () => {
    try {
      setLoading(true);
      setError('');

      // If we have a direct URL, use it
      if (fileUrl && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
        setPdfUrl(fileUrl);
        setLoading(false);
        return;
      }

      // Try to get signed URL from storage
      if (filePath) {
        // Try submissions bucket first
        const { data, error: err } = await supabase.storage
          .from('submissions')
          .createSignedUrl(filePath, 3600);

        if (!err && data?.signedUrl) {
          setPdfUrl(data.signedUrl);
          setLoading(false);
          return;
        }

        // Try materials bucket
        const { data: matData, error: matErr } = await supabase.storage
          .from('materials')
          .createSignedUrl(filePath, 3600);

        if (!matErr && matData?.signedUrl) {
          setPdfUrl(matData.signedUrl);
          setLoading(false);
          return;
        }

        // Try public URL as fallback
        const { data: pubData } = supabase.storage
          .from('submissions')
          .getPublicUrl(filePath);

        if (pubData?.publicUrl) {
          setPdfUrl(pubData.publicUrl);
          setLoading(false);
          return;
        }
      }

      setError('Could not load PDF. Please check storage permissions.');
      setLoading(false);
    } catch (err) {
      console.error('PDF load error:', err);
      setError('Failed to load PDF');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  const openInNewTab = () => {
    if (pdfUrl && typeof window !== 'undefined') {
      window.open(pdfUrl, '_blank');
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.fileName} numberOfLines={1}>
            {fileName || 'Document'}
          </Text>
          <TouchableOpacity onPress={openInNewTab} style={styles.openButton}>
            <Ionicons name="open-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading document...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={64} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadPdfUrl}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : Platform.OS === 'web' ? (
            // Web: Use iframe to display PDF
            <iframe
              src={pdfUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={fileName || 'PDF Document'}
            />
          ) : (
            // Mobile: Show message to open externally
            <View style={styles.mobileContainer}>
              <Ionicons name="document-text" size={80} color={Colors.primary} />
              <Text style={styles.mobileTitle}>{fileName || 'Document'}</Text>
              <Text style={styles.mobileText}>
                Tap the button below to view this document
              </Text>
              <TouchableOpacity style={styles.openExternalButton} onPress={openInNewTab}>
                <Ionicons name="open-outline" size={20} color={Colors.text.inverse} />
                <Text style={styles.openExternalText}>Open Document</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
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
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.card.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    paddingTop: 50, // Safe area
  },
  closeButton: {
    padding: Spacing.sm,
  },
  fileName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    marginHorizontal: Spacing.md,
  },
  openButton: {
    padding: Spacing.sm,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 25,
  },
  retryText: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  mobileContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  mobileTitle: {
    marginTop: Spacing.lg,
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  mobileText: {
    marginTop: Spacing.sm,
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  openExternalButton: {
    marginTop: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 25,
  },
  openExternalText: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
});
