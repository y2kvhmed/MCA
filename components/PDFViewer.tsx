import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import LoadingSpinner from './LoadingSpinner';
import { Spacing } from '../constants/Styles';

// For web compatibility, we'll use a WebView-based PDF viewer
import { WebView } from 'react-native-webview';

const { width, height } = Dimensions.get('window');

interface PDFViewerProps {
  uri: string;
  title?: string;
  onClose?: () => void;
}

export default function PDFViewer({ uri, title, onClose }: PDFViewerProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const styles = createStyles(colors);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  const handleError = () => {
    setError(true);
    setLoading(false);
    Alert.alert('Error', 'Failed to load PDF. Please try again.');
  };

  // Create PDF viewer HTML for web compatibility
  const pdfViewerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 0;
          background: #f5f5f5;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .pdf-container {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .pdf-viewer {
          flex: 1;
          border: none;
          background: white;
        }
        .error-message {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100%;
          color: #666;
        }
        .error-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
      </style>
    </head>
    <body>
      <div class="pdf-container">
        <iframe 
          src="${uri}#toolbar=1&navpanes=1&scrollbar=1&page=1&view=FitH"
          class="pdf-viewer"
          onload="window.ReactNativeWebView.postMessage('loaded')"
          onerror="window.ReactNativeWebView.postMessage('error')"
        ></iframe>
      </div>
    </body>
    </html>
  `;

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title || 'PDF Viewer'}</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.errorContainer}>
          <Ionicons name="document-text" size={64} color={colors.text.tertiary} />
          <Text style={styles.errorTitle}>Cannot Load PDF</Text>
          <Text style={styles.errorMessage}>
            The PDF file could not be loaded. Please check your internet connection and try again.
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setError(false);
              setLoading(true);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || 'PDF Viewer'}
        </Text>
        <TouchableOpacity 
          onPress={() => Alert.alert('Download', 'Download functionality would be implemented here')}
        >
          <Ionicons name="download" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading PDF...</Text>
        </View>
      )}

      <WebView
        source={{ html: pdfViewerHtml }}
        style={[styles.webview, loading && { opacity: 0 }]}
        onMessage={(event) => {
          const message = event.nativeEvent.data;
          if (message === 'loaded') {
            setLoading(false);
          } else if (message === 'error') {
            handleError();
          }
        }}
        onError={handleError}
        onHttpError={handleError}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />

      {!loading && (
        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={() => Alert.alert('Zoom', 'Zoom controls would be implemented here')}
          >
            <Ionicons name="search" size={20} color={colors.text.primary} />
            <Text style={styles.controlText}>Zoom</Text>
          </TouchableOpacity>
          
          <View style={styles.pageInfo}>
            <Text style={styles.pageText}>
              {totalPages > 0 ? `${currentPage} / ${totalPages}` : 'PDF Document'}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={() => Alert.alert('Share', 'Share functionality would be implemented here')}
          >
            <Ionicons name="share" size={20} color={colors.text.primary} />
            <Text style={styles.controlText}>Share</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: colors.card.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginHorizontal: Spacing.md,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    zIndex: 10,
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: 14,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: colors.card.background,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  controlButton: {
    alignItems: 'center',
    padding: Spacing.sm,
  },
  controlText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  pageInfo: {
    flex: 1,
    alignItems: 'center',
  },
  pageText: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
});