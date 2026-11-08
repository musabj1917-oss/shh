import React from 'react';
import { View, ViewStyle } from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function ChatsIcon({ size = 22, color = '#E6EAE8', style }: IconProps) {
  const stroke = Math.max(1.75, Math.round(size * 0.08));
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: size * 0.85,
          height: size * 0.72,
          borderRadius: Math.round(size * 0.28),
          borderCurve: 'continuous',
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.1,
          left: size * 0.22,
          width: stroke * 1.5,
          height: stroke * 1.5,
          backgroundColor: color,
          borderRadius: stroke * 0.75,
        }}
      />
    </View>
  );
}

export function MomentsIcon({ size = 22, color = '#E6EAE8', style }: IconProps) {
  const s = size * 0.44;
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: s,
          height: s,
          borderRadius: Math.round(s * 0.28),
          borderCurve: 'continuous',
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: s * 0.45,
          height: s * 0.45,
          borderRadius: Math.round(s * 0.15),
          borderCurve: 'continuous',
          backgroundColor: color,
          top: size * 0.12,
          right: size * 0.14,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

export function PeopleIcon({ size = 22, color = '#E6EAE8', style }: IconProps) {
  const stroke = Math.max(1.75, Math.round(size * 0.08));
  const headSize = Math.round(size * 0.36);
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: headSize,
          height: headSize,
          borderRadius: headSize / 2,
          borderWidth: stroke,
          borderColor: color,
          marginBottom: 2,
        }}
      />
      <View
        style={{
          width: size * 0.78,
          height: size * 0.38,
          borderTopLeftRadius: Math.round(size * 0.38),
          borderTopRightRadius: Math.round(size * 0.38),
          borderCurve: 'continuous',
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
}

export function SettingsIcon({ size = 22, color = '#E6EAE8', style }: IconProps) {
  const stroke = Math.max(1.75, Math.round(size * 0.08));
  const inner = Math.round(size * 0.3);
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: size * 0.8,
          height: size * 0.8,
          borderRadius: (size * 0.8) / 2,
          borderWidth: stroke,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

export function BellIcon({ size = 20, color = '#E6EAE8', style }: IconProps) {
  const stroke = Math.max(1.5, Math.round(size * 0.08));
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: size * 0.65,
          height: size * 0.65,
          borderTopLeftRadius: size * 0.35,
          borderTopRightRadius: size * 0.35,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      <View
        style={{
          width: size * 0.28,
          height: stroke * 1.5,
          backgroundColor: color,
          borderRadius: 2,
          marginTop: 2,
        }}
      />
    </View>
  );
}

export function SearchIcon({ size = 18, color = '#E6EAE8', style }: IconProps) {
  const stroke = Math.max(1.6, Math.round(size * 0.09));
  const glass = Math.round(size * 0.58);
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
      <View
        style={{
          width: glass,
          height: glass,
          borderRadius: glass / 2,
          borderWidth: stroke,
          borderColor: color,
          position: 'absolute',
          top: 1,
          left: 1,
        }}
      />
      <View
        style={{
          width: stroke,
          height: size * 0.38,
          backgroundColor: color,
          position: 'absolute',
          bottom: 1,
          right: 3,
          transform: [{ rotate: '-45deg' }],
          borderRadius: stroke / 2,
        }}
      />
    </View>
  );
}

export function PlusIcon({ size = 20, color = '#E6EAE8', style }: IconProps) {
  const stroke = Math.max(2, Math.round(size * 0.1));
  const len = size * 0.65;
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: len,
          height: stroke,
          backgroundColor: color,
          borderRadius: stroke / 2,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: stroke,
          height: len,
          backgroundColor: color,
          borderRadius: stroke / 2,
        }}
      />
    </View>
  );
}

export function BackIcon({ size = 20, color = '#E6EAE8', style }: IconProps) {
  const stroke = Math.max(2, Math.round(size * 0.1));
  const arm = size * 0.38;
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: arm,
          height: stroke,
          backgroundColor: color,
          position: 'absolute',
          top: size * 0.35,
          left: size * 0.28,
          transform: [{ rotate: '-45deg' }],
          borderRadius: stroke / 2,
        }}
      />
      <View
        style={{
          width: arm,
          height: stroke,
          backgroundColor: color,
          position: 'absolute',
          bottom: size * 0.35,
          left: size * 0.28,
          transform: [{ rotate: '45deg' }],
          borderRadius: stroke / 2,
        }}
      />
    </View>
  );
}

export function ChevronRightIcon({ size = 18, color = '#9AA6A1', style }: IconProps) {
  const stroke = Math.max(1.8, Math.round(size * 0.1));
  const arm = size * 0.36;
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: arm,
          height: stroke,
          backgroundColor: color,
          position: 'absolute',
          top: size * 0.34,
          right: size * 0.28,
          transform: [{ rotate: '45deg' }],
          borderRadius: stroke / 2,
        }}
      />
      <View
        style={{
          width: arm,
          height: stroke,
          backgroundColor: color,
          position: 'absolute',
          bottom: size * 0.34,
          right: size * 0.28,
          transform: [{ rotate: '-45deg' }],
          borderRadius: stroke / 2,
        }}
      />
    </View>
  );
}

export function SendIcon({ size = 20, color = '#0C1015', style }: IconProps) {
  const stroke = Math.max(2, Math.round(size * 0.1));
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: size * 0.44,
          height: stroke,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
          position: 'absolute',
          top: size * 0.3,
          borderRadius: stroke / 2,
        }}
      />
      <View
        style={{
          width: size * 0.44,
          height: stroke,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
          position: 'absolute',
          top: size * 0.3,
          borderRadius: stroke / 2,
        }}
      />
      <View
        style={{
          width: stroke,
          height: size * 0.55,
          backgroundColor: color,
          borderRadius: stroke / 2,
          marginTop: 2,
        }}
      />
    </View>
  );
}

export function CloseIcon({ size = 18, color = '#E6EAE8', style }: IconProps) {
  const stroke = Math.max(1.8, Math.round(size * 0.1));
  const len = size * 0.65;
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: len,
          height: stroke,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
          borderRadius: stroke / 2,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: len,
          height: stroke,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
          borderRadius: stroke / 2,
        }}
      />
    </View>
  );
}

export function PaperclipIcon({ size = 20, color = '#9AA6A1', style }: IconProps) {
  const stroke = Math.max(1.6, Math.round(size * 0.08));
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: size * 0.45,
          height: size * 0.7,
          borderRadius: (size * 0.45) / 2,
          borderWidth: stroke,
          borderColor: color,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
}

export function ShieldCheckIcon({ size = 20, color = '#4E9F86', style }: IconProps) {
  const stroke = Math.max(1.8, Math.round(size * 0.09));
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: size * 0.72,
          height: size * 0.8,
          borderWidth: stroke,
          borderColor: color,
          borderTopLeftRadius: size * 0.36,
          borderTopRightRadius: size * 0.36,
          borderBottomLeftRadius: size * 0.36,
          borderBottomRightRadius: size * 0.36,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: size * 0.22,
            height: size * 0.22,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

export function MapPinIcon({ size = 20, color = '#4E9F86', style }: IconProps) {
  const stroke = Math.max(1.8, Math.round(size * 0.09));
  const head = Math.round(size * 0.6);
  return (
    <View style={[{ width: size, height: size, alignItems: 'center' }, style]}>
      <View
        style={{
          width: head,
          height: head,
          borderRadius: head / 2,
          borderWidth: stroke,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: stroke * 1.5, height: stroke * 1.5, borderRadius: 2, backgroundColor: color }} />
      </View>
      <View
        style={{
          width: stroke,
          height: size * 0.3,
          backgroundColor: color,
          marginTop: -1,
          borderRadius: stroke / 2,
        }}
      />
    </View>
  );
}

export function MoreHorizontalIcon({ size = 20, color = '#9AA6A1', style }: IconProps) {
  const dotSize = Math.max(3.5, Math.round(size * 0.18));
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 1,
        },
        style,
      ]}
    >
      <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color }} />
      <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color }} />
      <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color }} />
    </View>
  );
}

export function CheckIcon({ size = 18, color = '#4E9F86', style }: IconProps) {
  const stroke = Math.max(2, Math.round(size * 0.11));
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: size * 0.28,
          height: stroke,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
          position: 'absolute',
          bottom: size * 0.32,
          left: size * 0.18,
          borderRadius: stroke / 2,
        }}
      />
      <View
        style={{
          width: size * 0.58,
          height: stroke,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
          position: 'absolute',
          bottom: size * 0.38,
          right: size * 0.15,
          borderRadius: stroke / 2,
        }}
      />
    </View>
  );
}

export function CameraIcon({ size = 22, color = '#E6EAE8', style }: IconProps) {
  const stroke = Math.max(1.75, Math.round(size * 0.08));
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: size * 0.88,
          height: size * 0.68,
          borderRadius: Math.round(size * 0.2),
          borderWidth: stroke,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: size * 0.32,
            height: size * 0.32,
            borderRadius: Math.round(size * 0.16),
            borderWidth: stroke,
            borderColor: color,
          }}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          top: size * 0.08,
          width: size * 0.28,
          height: stroke * 1.5,
          backgroundColor: color,
          borderRadius: stroke,
        }}
      />
    </View>
  );
}

export function MicrophoneIcon({ size = 20, color = '#E6EAE8', style }: IconProps) {
  const stroke = Math.max(1.75, Math.round(size * 0.08));
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: size * 0.36,
          height: size * 0.5,
          borderRadius: size * 0.18,
          borderWidth: stroke,
          borderColor: color,
          backgroundColor: 'transparent',
          top: -size * 0.04,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.62,
          height: size * 0.44,
          borderBottomLeftRadius: size * 0.31,
          borderBottomRightRadius: size * 0.31,
          borderWidth: stroke,
          borderTopWidth: 0,
          borderColor: color,
          top: size * 0.22,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.12,
          width: stroke,
          height: size * 0.2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.1,
          width: size * 0.36,
          height: stroke,
          borderRadius: stroke / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function VideoIcon({ size = 20, color = '#E6EAE8', style }: IconProps) {
  const stroke = Math.max(1.75, Math.round(size * 0.08));
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: size * 0.58,
          height: size * 0.5,
          borderRadius: Math.round(size * 0.12),
          borderWidth: stroke,
          borderColor: color,
          position: 'absolute',
          left: size * 0.08,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: size * 0.06,
          width: 0,
          height: 0,
          borderTopWidth: size * 0.18,
          borderBottomWidth: size * 0.18,
          borderRightWidth: size * 0.24,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderRightColor: color,
          transform: [{ rotate: '180deg' }],
        }}
      />
    </View>
  );
}

export function PlayIcon({ size = 18, color = '#E6EAE8', style }: IconProps) {
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: size * 0.34,
          borderBottomWidth: size * 0.34,
          borderLeftWidth: size * 0.55,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
          marginLeft: size * 0.12,
        }}
      />
    </View>
  );
}

export function PauseIcon({ size = 18, color = '#E6EAE8', style }: IconProps) {
  const barWidth = Math.max(2, Math.round(size * 0.18));
  return (
    <View style={[{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: size * 0.2 }, style]}>
      <View style={{ width: barWidth, height: size * 0.65, borderRadius: barWidth / 2, backgroundColor: color }} />
      <View style={{ width: barWidth, height: size * 0.65, borderRadius: barWidth / 2, backgroundColor: color }} />
    </View>
  );
}

export function RadarIcon({ size = 22, color = '#E6EAE8', style }: IconProps) {
  const stroke = Math.max(1.5, Math.round(size * 0.08));
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: size * 0.9,
          height: size * 0.9,
          borderRadius: size * 0.45,
          borderWidth: stroke,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: size * 0.5,
            height: size * 0.5,
            borderRadius: size * 0.25,
            borderWidth: stroke,
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: stroke * 2,
              height: stroke * 2,
              borderRadius: stroke,
              backgroundColor: color,
            }}
          />
        </View>
      </View>
      <View
        style={{
          position: 'absolute',
          top: 0,
          width: stroke,
          height: size * 0.16,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          width: stroke,
          height: size * 0.16,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function GroupsIcon({ size = 22, color = '#E6EAE8', style }: IconProps) {
  const stroke = Math.max(1.5, Math.round(size * 0.08));
  const headSize = Math.round(size * 0.28);
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: headSize,
          height: headSize,
          borderRadius: headSize / 2,
          borderWidth: stroke,
          borderColor: color,
          top: -size * 0.08,
          zIndex: 2,
        }}
      />
      <View
        style={{
          width: size * 0.58,
          height: size * 0.3,
          borderTopLeftRadius: size * 0.29,
          borderTopRightRadius: size * 0.29,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: color,
          top: -size * 0.06,
          zIndex: 2,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: size * 0.38,
          width: size * 0.34,
          height: size * 0.26,
          borderTopLeftRadius: size * 0.17,
          borderTopRightRadius: size * 0.17,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: color,
          opacity: 0.75,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: size * 0.38,
          width: size * 0.34,
          height: size * 0.26,
          borderTopLeftRadius: size * 0.17,
          borderTopRightRadius: size * 0.17,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: color,
          opacity: 0.75,
        }}
      />
    </View>
  );
}




