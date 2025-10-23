import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface DownloadProgressProps {
  fileName: string;
  fileSize: number;
  downloadedBytes: number;
  downloadSpeed?: number;
  onCancel?: () => void;
  onComplete?: () => void;
  status: 'downloading' | 'completed' | 'error' | 'cancelled';
}

export default function DownloadProgress({
  fileName,
  fileSize,
  downloadedBytes,
  downloadSpeed = 0,
  onCancel,
  onComplete,
  status,
}: DownloadProgressProps) {
  const [progressAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));

  const progress = Math.min(downloadedBytes / fileSize, 1);
  const progressPercent = Math.round(progress * 100);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();

    if (status === 'downloading') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [progress, status]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  const getTimeRemaining = () => {
    if (downloadSpeed === 0) return 'Calculating...';
    const remainingBytes = fileSize - downloadedBytes;
    const remainingSeconds = remainingBytes / downloadSpeed;
    
    if (remainingSeconds < 60) {
      return `${Math.round(remainingSeconds)}s remaining`;
    } else if (remainingSeconds < 3600) {
      return `${Math.round(remainingSeconds / 60)}m remaining`;
    } else {
      return `${Math.round(remainingSeconds / 3600)}h remaining`;
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: 'checkmark-circle',
          color: Colors.success,
          message: 'Download completed',
        };
      case 'error':
        return {
          icon: 'alert-circle',
          color: Colors.error,
          message: 'Download failed',
        };
      case 'cancelled':
        return {
          icon: 'close-circle',
          color: Colors.warning,
          message: 'Download cancelled',
        };
      default:
        return {
          icon: 'download',
          color: Colors.primary,
          message: 'Downloading...',
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name={statusConfig.icon as any} size={24} color={statusConfig.color} />
        </Animated.View>
        
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {fileName}
          </Text>
          <Text style={styles.fileSize}>
            {formatBytes(downloadedBytes)} / {formatBytes(fileSize)}
          </Text>
        </View>
        
        {status === 'downloading' && onCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Ionicons name="close" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: statusConfig.color,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{progressPercent}%</Text>
      </View>

      <View style={styles.details}>
        <Text style={[styles.status, { color: statusConfig.color }]}>
          {statusConfig.message}
        </Text>
        
        {status === 'downloading' && downloadSpeed > 0 && (
          <View style={styles.speedInfo}>
            <Text style={styles.speed}>{formatSpeed(downloadSpeed)}</Text>
            <Text style={styles.timeRemaining}>{getTimeRemaining()}</Text>
          </View>
        )}
      </View>

      {status === 'completed' && onComplete && (
        <TouchableOpacity style={styles.actionButton} onPress={onComplete}>
          <Ionicons name="folder-open" size={16} color={Colors.text.inverse} />
          <Text style={styles.actionText}>Open File</Text>
        </TouchableOpacity>
      )}

      {status === 'error' && (
        <TouchableOpacity style={[styles.actionButton, styles.retryButton]}>
          <Ionicons name="refresh" size={16} color={Colors.text.inverse} />
          <Text style={styles.actionText}>Retry Download</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card.background,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  cancelButton: {
    padding: Spacing.sm,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border.light,
    borderRadius: 3,
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
    minWidth: 35,
    textAlign: 'right',
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
  },
  speedInfo: {
    alignItems: 'flex-end',
  },
  speed: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  timeRemaining: {
    fontSize: 11,
    color: Colors.text.secondary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    marginTop: Spacing.sm,
  },
  retryButton: {
    backgroundColor: Colors.error,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.inverse,
    marginLeft: Spacing.xs,
  },
});