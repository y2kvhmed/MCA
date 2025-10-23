import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../constants/Colors';

const { width, height } = Dimensions.get('window');

interface GeometricBackgroundProps {
  opacity?: number;
  patternSize?: number;
}

export default function GeometricBackground({ 
  opacity = 0.4, 
  patternSize = 80 
}: GeometricBackgroundProps) {
  
  // Generate layered grid pattern with offset
  const generateLayeredGrid = () => {
    const elements = [];
    const cols = Math.ceil(width / patternSize) + 1;
    const rows = Math.ceil(height / patternSize) + 1;
    const offset = 20; // Much larger offset for more diagonal separation
    
    // First layer: Dark blue grid (offset down and left)
    // Create horizontal lines (dark blue)
    for (let row = 0; row <= rows; row++) {
      const y = row * patternSize + offset;
      
      elements.push(
        <View
          key={`h-blue-${row}`}
          style={[
            styles.horizontalLine,
            {
              top: y,
              left: -offset,
              opacity: opacity * 0.8, // Slightly less opacity for depth
              backgroundColor: Colors.primary,
            }
          ]}
        />
      );
    }
    
    // Create vertical lines (dark blue)
    for (let col = 0; col <= cols; col++) {
      const x = col * patternSize - offset;
      
      elements.push(
        <View
          key={`v-blue-${col}`}
          style={[
            styles.verticalLine,
            {
              left: x,
              top: offset,
              opacity: opacity * 0.8, // Slightly less opacity for depth
              backgroundColor: Colors.primary,
            }
          ]}
        />
      );
    }
    
    // Second layer: Yellow grid (on top)
    // Create horizontal lines (yellow)
    for (let row = 0; row <= rows; row++) {
      const y = row * patternSize;
      
      elements.push(
        <View
          key={`h-yellow-${row}`}
          style={[
            styles.horizontalLine,
            {
              top: y,
              opacity: opacity,
              backgroundColor: Colors.accent,
            }
          ]}
        />
      );
    }
    
    // Create vertical lines (yellow)
    for (let col = 0; col <= cols; col++) {
      const x = col * patternSize;
      
      elements.push(
        <View
          key={`v-yellow-${col}`}
          style={[
            styles.verticalLine,
            {
              left: x,
              opacity: opacity,
              backgroundColor: Colors.accent,
            }
          ]}
        />
      );
    }
    
    return elements;
  };

  return (
    <View style={styles.container}>
      {generateLayeredGrid()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
    overflow: 'hidden',
  },
  horizontalLine: {
    position: 'absolute',
    width: '100%',
    height: 3, // Thicker lines
  },
  verticalLine: {
    position: 'absolute',
    width: 3, // Thicker lines
    height: '100%',
  },
});