import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C } from '../../constants/colors';

interface Props {
  size: number;
  strokeWidth: number;
  progress: number;   // 0.0 → 1.0 (can exceed 1.0 for over-limit)
  color: string;
  children?: React.ReactNode;
}

export default function CircularProgress({
  size,
  strokeWidth,
  progress,
  color,
  children,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(progress, 1);
  const strokeDashoffset = circumference * (1 - clampedProgress);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      {/* SVG ring — rotated so progress starts from top */}
      <Svg
        width={size}
        height={size}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        {/* Background track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={C.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>

      {/* Centered content overlay */}
      <View style={[StyleSheet.absoluteFillObject, styles.centerContent]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
