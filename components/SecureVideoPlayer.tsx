import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import { supabase } from '../lib/supabase';

interface SecureVideoPlayerProps {
  videoPath: string;
  title?: string;
  autoplay?: boolean;
}

export default function SecureVideoPlayer({ videoPath, title, autoplay = false }: SecureVideoPlayerProps) {
  const [videoUri, setVideoUri] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  const videoRef = useRef<Video>(null);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    loadSecureVideoUrl();
  }, [videoPath]);

  const loadSecureVideoUrl = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!videoPath) {
        setError('No video source provided');
        setLoading(false);
        return;
      }

      if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
        setVideoUri(videoPath);
        setLoading(false);
        return;
      }
      
      // Try recordings bucket first, then videos, then lessons
      for (const bucket of ['recordings', 'videos', 'lessons']) {
        const { data: d, error: e } = await supabase.storage
          .from(bucket)
          .createSignedUrl(videoPath, 7200);
        if (!e && d?.signedUrl) {
          setVideoUri(d.signedUrl);
          setLoading(false);
          return;
        }

        // Try public URL
        const { data: pubData } = supabase.storage
          .from(bucket)
          .getPublicUrl(videoPath);
        if (pubData?.publicUrl) {
          setVideoUri(pubData.publicUrl);
          setLoading(false);
          return;
        }
      }
      
      setError('Video file not accessible');
      setLoading(false);
    } catch (err) {
      setError('Failed to load video');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading video...</Text>
      </View>
    );
  }

  if (error || !videoUri) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={40} color={Colors.error} />
        <Text style={styles.errorText}>{error || 'Video unavailable'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadSecureVideoUrl}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Web Implementation: Native HTML5 video player
  // - Instant 1-tap playback (zero unresponsiveness or touch collisions)
  // - object-fit: contain (100% full video shown, zero crop)
  // - controlsList="nodownload" (removes download option in standard and fullscreen)
  // - onContextMenu preventDefault (removes right-click Save video as...)
  if (Platform.OS === 'web') {
    return (
      <View style={styles.playerContainer}>
        {React.createElement('video', {
          ref: webVideoRef,
          src: videoUri,
          controls: true,
          controlsList: 'nodownload noplaybackrate',
          playsInline: true,
          disablePictureInPicture: true,
          preload: 'metadata',
          onContextMenu: (e: any) => e.preventDefault(),
          style: {
            width: '100%',
            aspectRatio: '16 / 9',
            maxHeight: '480px',
            backgroundColor: '#000',
            borderRadius: '10px',
            objectFit: 'contain',
            outline: 'none',
            display: 'block',
          },
        })}
      </View>
    );
  }

  // Mobile Native Implementation
  return (
    <View style={styles.playerContainer}>
      <Video
        ref={videoRef}
        style={styles.nativeVideo}
        source={{ uri: videoUri }}
        useNativeControls={true}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={autoplay}
        isLooping={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  playerContainer: {
    width: '100%',
    backgroundColor: '#000',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  nativeVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  loadingContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 260,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    marginTop: Spacing.sm,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: Spacing.sm,
  },
  errorContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 240,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: Spacing.lg,
    borderRadius: 10,
    marginTop: Spacing.sm,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: Spacing.sm,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: 6,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
