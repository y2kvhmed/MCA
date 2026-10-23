import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import { supabase } from '../lib/supabase';

// Video player component with native controls

interface NativeVideoPlayerProps {
  videoPath: string; // Supabase storage path
  title?: string;
  autoplay?: boolean;
  showControls?: boolean;
  poster?: string;
}

export default function NativeVideoPlayer({ 
  videoPath, 
  title, 
  autoplay = false, 
  showControls = true,
  poster
}: NativeVideoPlayerProps) {
  const [showPlayer, setShowPlayer] = useState(autoplay);
  const [videoUri, setVideoUri] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    loadSecureVideoUrl();
  }, [videoPath]);

  const loadSecureVideoUrl = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Loading video from path:', videoPath);
      
      // If it's already a full URL, use it directly
      if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
        setVideoUri(videoPath);
        setLoading(false);
        return;
      }
      
      // The video is stored in 'videos' bucket with path like 'recordings/global/filename.mp4'
      // or 'recordings/schoolId/filename.mp4'
      
      // First, try the videos bucket with the exact path (most common case)
      console.log('Trying videos bucket with path:', videoPath);
      const { data: videosData, error: videosError } = await supabase.storage
        .from('videos')
        .createSignedUrl(videoPath, 9000);
      
      if (!videosError && videosData?.signedUrl) {
        console.log('Found video in videos bucket');
        setVideoUri(videosData.signedUrl);
        setLoading(false);
        return;
      }
      
      // Try public URL from videos bucket
      const { data: publicData } = supabase.storage
        .from('videos')
        .getPublicUrl(videoPath);
      
      if (publicData?.publicUrl) {
        // Test if the public URL works
        try {
          const testResponse = await fetch(publicData.publicUrl, { method: 'HEAD' });
          if (testResponse.ok) {
            console.log('Using public URL from videos bucket');
            setVideoUri(publicData.publicUrl);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.log('Public URL test failed, trying other methods');
        }
      }
      
      // Try other buckets as fallback
      const bucketsToTry = ['recordings', 'lessons'];
      
      for (const bucket of bucketsToTry) {
        console.log('Trying bucket:', bucket, 'path:', videoPath);
        
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(videoPath, 9000);
        
        if (!error && data?.signedUrl) {
          console.log('Found video in bucket:', bucket);
          setVideoUri(data.signedUrl);
          setLoading(false);
          return;
        }
        
        // Try without 'recordings/' prefix if path starts with it
        if (videoPath.startsWith('recordings/')) {
          const pathWithoutPrefix = videoPath.replace('recordings/', '');
          const { data: data2, error: error2 } = await supabase.storage
            .from(bucket)
            .createSignedUrl(pathWithoutPrefix, 9000);
          
          if (!error2 && data2?.signedUrl) {
            console.log('Found video in bucket with modified path:', bucket);
            setVideoUri(data2.signedUrl);
            setLoading(false);
            return;
          }
        }
      }
      
      console.error('Video not found in any bucket. Path:', videoPath);
      setError('Video not found');
      setLoading(false);
    } catch (error) {
      console.error('Error loading video:', error);
      setError('Failed to load video');
      setLoading(false);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.presentFullscreenPlayer();
      }
    } catch (error) {
      console.error('Error entering fullscreen:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSecureVideoUrl}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!videoUri) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No video available</Text>
        </View>
      </View>
    );
  }

  if (!showPlayer) {
    return (
      <View style={styles.thumbnail}>
        <View style={styles.thumbnailOverlay}>
          <TouchableOpacity 
            style={styles.playButton}
            onPress={() => setShowPlayer(true)}
          >
            <Ionicons name="play" size={32} color={Colors.text.inverse} />
          </TouchableOpacity>
        </View>
        {title && (
          <View style={styles.titleContainer}>
            <Text style={styles.videoTitle}>{title}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {title && (
        <View style={styles.header}>
          <Text style={styles.videoTitle}>{title}</Text>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setShowPlayer(false)}
          >
            <Ionicons name="close" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.playerContainer}>
        <Video
          ref={videoRef}
          style={styles.video}
          source={{ uri: videoUri }}
          useNativeControls={true}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={autoplay}
          isLooping={false}
          posterSource={poster ? { uri: poster } : undefined}
          usePoster={!!poster}
          videoStyle={{ backgroundColor: '#000' }}
          onFullscreenUpdate={(event) => {
            console.log('Fullscreen update:', event.fullscreenUpdate);
          }}
        />
        
        {/* Fullscreen button overlay */}
        <TouchableOpacity 
          style={styles.fullscreenOverlay}
          onPress={toggleFullscreen}
        >
          <Ionicons name="expand" size={20} color={Colors.text.inverse} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card.background,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.background,
  },
  videoTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  thumbnail: {
    width: '100%',
    height: 220,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  titleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: Spacing.md,
  },
  playerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenOverlay: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  loadingContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: Spacing.md,
  },
  errorContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: Spacing.lg,
    borderRadius: 12,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: Spacing.md,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 25,
    marginTop: Spacing.sm,
  },
  retryText: {
    color: Colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
});