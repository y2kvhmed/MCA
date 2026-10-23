import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

import { isGoogleDriveSource, getSecureStreamUrl } from '../lib/videoStream';

interface SecureVideoPlayerProps {
  videoPath: string;
  lessonId?: string;
  title?: string;
  autoplay?: boolean;
}

export default function SecureVideoPlayer({ videoPath, lessonId, title, autoplay = false }: SecureVideoPlayerProps) {
  const [videoUri, setVideoUri] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [watermarkText, setWatermarkText] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const videoRef = useRef<Video>(null);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<any>(null);

  useEffect(() => {
    loadUserWatermark();
  }, []);

  useEffect(() => {
    loadSecureVideoUrl();
  }, [videoPath, lessonId]);

  // Track fullscreen changes on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleFullscreenChange = () => {
      const isFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const loadUserWatermark = async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        const idBadge = user.phone || user.email || (user.id ? user.id.slice(0, 8) : 'Student');
        setWatermarkText(`${user.name || 'Student'} • ${idBadge}`);
      } else {
        setWatermarkText('Bedaya Physics • Secure Stream');
      }
    } catch {
      setWatermarkText('Bedaya Physics • Secure Stream');
    }
  };

  const parseStorageUrl = (url: string): { bucket: string; path: string } | null => {
    try {
      const regex = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/;
      const match = url.match(regex);
      if (match && match[1] && match[2]) {
        return {
          bucket: match[1],
          path: decodeURIComponent(match[2].split('?')[0]),
        };
      }
    } catch (e) {
      // Ignore
    }
    return null;
  };

  const loadSecureVideoUrl = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!videoPath) {
        setError('No video source provided');
        setLoading(false);
        return;
      }

      // Check if source is Google Drive or relay-enabled lesson
      if (isGoogleDriveSource(videoPath) || (lessonId && !parseStorageUrl(videoPath))) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';
        const relayUrl = getSecureStreamUrl({ lessonId, videoPath, token });
        setVideoUri(relayUrl);
        setLoading(false);
        return;
      }

      // Check if path is a Supabase Storage URL - extract and sign it
      const parsed = parseStorageUrl(videoPath);
      if (parsed) {
        const { data: signData, error: signError } = await supabase.storage
          .from(parsed.bucket)
          .createSignedUrl(parsed.path, 9000); // 2.5 hours (150 minutes) signed URL

        if (!signError && signData?.signedUrl) {
          setVideoUri(signData.signedUrl);
          setLoading(false);
          return;
        }
      }

      // If already a remote external URL (e.g. YouTube, Vimeo or external CDN)
      if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
        setVideoUri(videoPath);
        setLoading(false);
        return;
      }
      
      // Query private storage buckets with short-lived signed URLs (2.5 hours)
      for (const bucket of ['recordings', 'videos', 'lessons']) {
        const { data: d, error: e } = await supabase.storage
          .from(bucket)
          .createSignedUrl(videoPath, 9000); // 2.5 hours signed URL
        if (!e && d?.signedUrl) {
          setVideoUri(d.signedUrl);
          setLoading(false);
          return;
        }

        // Fallback to public URL only if bucket is configured as public
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

  const toggleWebFullscreen = () => {
    if (Platform.OS !== 'web') return;
    const el = containerRef.current;
    if (!el) return;

    const isFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (!isFs) {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Securing lesson stream...</Text>
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

  // Web Implementation: Protected In-App Fullscreen & Watermarked Player
  // - Context menu completely suppressed (NO "Copy video address", NO "Save video as")
  // - controlsList removes browser download options
  // - In-App container fullscreen keeps video strictly inside website
  // - Faint dynamic watermark overlay stays visible even in fullscreen
  if (Platform.OS === 'web') {
    return (
      <div
        ref={containerRef}
        onContextMenu={(e: any) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }}
        onDragStart={(e: any) => {
          e.preventDefault();
          return false;
        }}
        style={{
          position: 'relative',
          width: '100%',
          backgroundColor: '#000000',
          borderRadius: isFullscreen ? '0px' : '10px',
          overflow: 'hidden',
          marginTop: isFullscreen ? '0px' : '8px',
          border: isFullscreen ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {React.createElement('video', {
          ref: webVideoRef,
          src: videoUri,
          controls: true,
          controlsList: 'nodownload noplaybackrate nofullscreen',
          playsInline: true,
          disablePictureInPicture: true,
          preload: 'metadata',
          onContextMenu: (e: any) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          },
          style: {
            width: '100%',
            height: isFullscreen ? '100vh' : 'auto',
            aspectRatio: isFullscreen ? 'auto' : '16 / 9',
            maxHeight: isFullscreen ? '100vh' : '480px',
            backgroundColor: '#000',
            objectFit: 'contain',
            outline: 'none',
            display: 'block',
          },
        })}

        {/* Faint Anti-Piracy Watermark Overlay (Adaptive size, 100% non-intrusive) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 15,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '12px 16px 42px 16px',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          {/* Top-Right Corner Watermark */}
          <div
            style={{
              alignSelf: 'flex-end',
              color: 'rgba(255, 255, 255, 0.16)',
              fontSize: 'clamp(10px, 1.2vw, 13px)',
              fontWeight: 600,
              letterSpacing: '0.5px',
              textShadow: '0 0 2px rgba(0, 0, 0, 0.6)',
            }}
          >
            {watermarkText}
          </div>

          {/* Center Floating Diagonal Watermark */}
          <div
            style={{
              alignSelf: 'center',
              transform: 'rotate(-14deg)',
              color: 'rgba(255, 255, 255, 0.12)',
              fontSize: 'clamp(12px, 2vw, 18px)',
              fontWeight: 700,
              letterSpacing: '1px',
              textShadow: '0 0 3px rgba(0, 0, 0, 0.6)',
              pointerEvents: 'none',
            }}
          >
            {watermarkText}
          </div>

          {/* Bottom-Left Corner Watermark */}
          <div
            style={{
              alignSelf: 'flex-start',
              color: 'rgba(255, 255, 255, 0.16)',
              fontSize: 'clamp(10px, 1.2vw, 13px)',
              fontWeight: 600,
              letterSpacing: '0.5px',
              textShadow: '0 0 2px rgba(0, 0, 0, 0.6)',
            }}
          >
            {watermarkText}
          </div>
        </div>

        {/* In-App Fullscreen Toggle Button (Remains inside website domain) */}
        <button
          onClick={toggleWebFullscreen}
          type="button"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          style={{
            position: 'absolute',
            bottom: isFullscreen ? '14px' : '10px',
            right: isFullscreen ? '16px' : '12px',
            zIndex: 25,
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            color: '#FFFFFF',
            cursor: 'pointer',
            padding: '5px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            backdropFilter: 'blur(4px)',
            transition: 'background 0.2s',
          }}
        >
          <span style={{ fontSize: '13px' }}>{isFullscreen ? '⤢' : '⤡'}</span>
          <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
        </button>
      </div>
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
      {/* Mobile Watermark Overlay */}
      <View style={styles.nativeWatermarkOverlay} pointerEvents="none">
        <Text style={styles.nativeWatermarkTextTop}>{watermarkText}</Text>
        <Text style={styles.nativeWatermarkTextCenter}>{watermarkText}</Text>
        <Text style={styles.nativeWatermarkTextBottom}>{watermarkText}</Text>
      </View>
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
    position: 'relative',
  },
  nativeVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  nativeWatermarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 12,
    zIndex: 10,
  },
  nativeWatermarkTextTop: {
    alignSelf: 'flex-end',
    color: 'rgba(255, 255, 255, 0.16)',
    fontSize: 11,
    fontWeight: '600',
  },
  nativeWatermarkTextCenter: {
    alignSelf: 'center',
    color: 'rgba(255, 255, 255, 0.12)',
    fontSize: 13,
    fontWeight: '700',
    transform: [{ rotate: '-14deg' }],
  },
  nativeWatermarkTextBottom: {
    alignSelf: 'flex-start',
    color: 'rgba(255, 255, 255, 0.16)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 20,
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
