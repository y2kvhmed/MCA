import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

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
  const [status, setStatus] = useState<AVPlaybackStatus>({} as AVPlaybackStatus);
  const [showPlayer, setShowPlayer] = useState(autoplay);
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [showCustomControls, setShowCustomControls] = useState(false);
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
      
      // Get signed URL from Supabase storage (expires in 1 hour)
      const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(videoPath, 3600); // 1 hour expiry
      
      if (error) {
        console.error('Error getting video URL:', error);
        setError('Failed to load video');
        setLoading(false);
        return;
      }
      
      if (data?.signedUrl) {
        setVideoUri(data.signedUrl);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading video:', error);
      setError('Failed to load video');
      setLoading(false);
    }
  };

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = async (position: number) => {
    if (videoRef.current && 'durationMillis' in status && status.durationMillis) {
      const seekPosition = (position / 100) * status.durationMillis;
      await videoRef.current.setPositionAsync(seekPosition);
    }
  };

  const toggleFullscreen = async () => {
    if (videoRef.current) {
      await videoRef.current.presentFullscreenPlayer();
    }
  };

  const onPlaybackStatusUpdate = (playbackStatus: AVPlaybackStatus) => {
    setStatus(playbackStatus);
    if ('isPlaying' in playbackStatus) {
      setIsPlaying(playbackStatus.isPlaying);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading secure video...</Text>
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

  const progressPercentage = 
    'durationMillis' in status && 'positionMillis' in status && status.durationMillis
      ? (status.positionMillis / status.durationMillis) * 100
      : 0;

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
      
      <TouchableOpacity 
        style={styles.playerContainer}
        onPress={() => setShowCustomControls(!showCustomControls)}
        activeOpacity={1}
      >
        <Video
          ref={videoRef}
          style={styles.video}
          source={{ uri: videoUri }}
          useNativeControls={!showControls}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={autoplay}
          isLooping={false}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          posterSource={poster ? { uri: poster } : undefined}
          usePoster={!!poster}
        />
        
        {showControls && showCustomControls && (
          <View style={styles.customControls}>
            <View style={styles.controlsOverlay}>
              {/* Play/Pause Button */}
              <TouchableOpacity 
                style={styles.playPauseButton}
                onPress={handlePlayPause}
              >
                <Ionicons 
                  name={isPlaying ? "pause" : "play"} 
                  size={32} 
                  color={Colors.text.inverse} 
                />
              </TouchableOpacity>
              
              {/* Fullscreen Button */}
              <TouchableOpacity 
                style={styles.fullscreenButton}
                onPress={toggleFullscreen}
              >
                <Ionicons name="expand" size={24} color={Colors.text.inverse} />
              </TouchableOpacity>
            </View>
            
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[styles.progressFill, { width: `${progressPercentage}%` }]} 
                />
                <View
                  style={[styles.progressThumb, { left: `${progressPercentage}%` }]}
                />
              </View>
              
              {/* Time Display */}
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>
                  {'positionMillis' in status ? formatTime(status.positionMillis) : '0:00'}
                </Text>
                <Text style={styles.timeText}>
                  {'durationMillis' in status && status.durationMillis 
                    ? formatTime(status.durationMillis) 
                    : '0:00'
                  }
                </Text>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
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
    height: 200,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
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
    height: 220,
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    flex: 1,
  },
  customControls: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  controlsOverlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    marginLeft: -8,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: Colors.text.inverse,
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.text.secondary,
    fontSize: 16,
  },
  errorContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  errorText: {
    color: Colors.error,
    fontSize: 16,
    textAlign: 'center',
    marginVertical: Spacing.md,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
});