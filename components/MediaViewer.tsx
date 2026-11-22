import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  Platform,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import { isImageFile } from '../lib/fileUpload';

export interface ViewerFile {
  path?: string;
  url?: string;
  name?: string;
  type?: string;
  size?: number;
}

interface MediaViewerProps {
  visible: boolean;
  files: ViewerFile[];
  initialIndex?: number;
  onClose: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

function MediaContent({ file }: { file: ViewerFile }) {
  const url = file?.url || '';

  if (isImageFile(file) && url) {
    return <Image source={{ uri: url }} style={styles.image} resizeMode="contain" />;
  }

  if (Platform.OS === 'web' && url) {
    return (
      <iframe
        src={url}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title={file?.name || 'Document'}
      />
    );
  }

  return (
    <View style={styles.fallback}>
      <Ionicons name="document-text" size={72} color="#ffffff" />
      <Text style={styles.fallbackText} numberOfLines={2}>{file?.name || 'Document'}</Text>
      {url ? (
        <TouchableOpacity style={styles.openButton} onPress={() => Linking.openURL(url)}>
          <Ionicons name="open-outline" size={18} color={Colors.text.inverse} />
          <Text style={styles.openButtonText}>Open</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function MediaViewer({ visible, files, initialIndex = 0, onClose }: MediaViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [width, setWidth] = useState(SCREEN_WIDTH);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!visible) return;
    setIndex(initialIndex);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: initialIndex * width, animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, initialIndex, width]);

  if (!visible || files.length === 0) return null;

  const total = files.length;
  const current = files[Math.min(index, total - 1)];

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(total - 1, next));
    setIndex(clamped);
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
  };

  const onMomentumEnd = (event: any) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
    if (next !== index) setIndex(next);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={styles.container}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width || SCREEN_WIDTH)}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={26} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{current?.name || 'Attachment'}</Text>
          {total > 1 ? (
            <Text style={styles.counter}>{index + 1} / {total}</Text>
          ) : (
            <View style={styles.headerButton} />
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          style={styles.pager}
        >
          {files.map((file, i) => (
            <View key={`${file.path || file.name}-${i}`} style={[styles.page, { width }]}>
              <MediaContent file={file} />
            </View>
          ))}
        </ScrollView>

        {total > 1 && index > 0 && (
          <TouchableOpacity style={[styles.arrow, styles.arrowLeft]} onPress={() => goTo(index - 1)}>
            <Ionicons name="chevron-back" size={26} color="#ffffff" />
          </TouchableOpacity>
        )}
        {total > 1 && index < total - 1 && (
          <TouchableOpacity style={[styles.arrow, styles.arrowRight]} onPress={() => goTo(index + 1)}>
            <Ionicons name="chevron-forward" size={26} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 50,
    paddingBottom: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  headerButton: {
    padding: Spacing.xs,
    width: 40,
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginHorizontal: Spacing.sm,
  },
  counter: {
    width: 40,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  pager: {
    flex: 1,
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  fallbackText: {
    marginTop: Spacing.lg,
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  openButton: {
    marginTop: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 25,
  },
  openButtonText: {
    color: Colors.text.inverse,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  arrowLeft: {
    left: Spacing.md,
  },
  arrowRight: {
    right: Spacing.md,
  },
});
