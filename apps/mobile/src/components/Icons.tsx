import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ICON_STROKE, IconName, iconPaths } from './iconPaths';

export interface IconProps {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export interface IconComponentProps extends IconProps {
  name: IconName;
  strokeWidth?: number;
  fill?: string;
}

export function Icon({
  name,
  size = 22,
  color = '#E6EAE8',
  style,
  strokeWidth = name === 'more' ? 2.4 : ICON_STROKE,
  fill = name === 'play' ? color : 'none',
}: IconComponentProps) {
  const entries = iconPaths[name] || [];

  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} style={style}>
      {entries.map((entry, idx) => (
        <Path
          key={`${name}-${idx}-${entry.d}`}
          d={entry.d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={fill}
          strokeDasharray={entry.dash}
        />
      ))}
    </Svg>
  );
}

export function ChatsIcon({ size = 22, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="chats" size={size} color={color} style={style} />;
}

export function PeopleIcon({ size = 22, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="friends" size={size} color={color} style={style} />;
}

export function GroupsIcon({ size = 22, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="groups" size={size} color={color} style={style} />;
}

export function MomentsIcon({ size = 22, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="moments" size={size} color={color} style={style} />;
}

export function RadarIcon({ size = 22, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="radar" size={size} color={color} style={style} />;
}

export function SettingsIcon({ size = 22, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="settings" size={size} color={color} style={style} />;
}

export function CameraIcon({ size = 22, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="camera" size={size} color={color} style={style} />;
}

export function MicrophoneIcon({ size = 20, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="mic" size={size} color={color} style={style} />;
}

export function SendIcon({ size = 20, color = '#0C1015', style }: IconProps) {
  return <Icon name="send" size={size} color={color} style={style} />;
}

export function PlusIcon({ size = 20, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="plus" size={size} color={color} style={style} />;
}

export function SearchIcon({ size = 18, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="search" size={size} color={color} style={style} />;
}

export function CloseIcon({ size = 18, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="close" size={size} color={color} style={style} />;
}

export function BackIcon({ size = 20, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="back" size={size} color={color} style={style} />;
}

export function MapPinIcon({ size = 20, color = '#4E9F86', style }: IconProps) {
  return <Icon name="location" size={size} color={color} style={style} />;
}

export function VideoIcon({ size = 20, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="video" size={size} color={color} style={style} />;
}

export function BellIcon({ size = 20, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="bell" size={size} color={color} style={style} />;
}

export function ChevronRightIcon({ size = 18, color = '#9AA6A1', style }: IconProps) {
  return <Icon name="chevron-right" size={size} color={color} style={style} />;
}

export function PaperclipIcon({ size = 20, color = '#9AA6A1', style }: IconProps) {
  return <Icon name="paperclip" size={size} color={color} style={style} />;
}

export function ShieldCheckIcon({ size = 20, color = '#4E9F86', style }: IconProps) {
  return <Icon name="shield-check" size={size} color={color} style={style} />;
}

export function MoreHorizontalIcon({ size = 20, color = '#9AA6A1', style }: IconProps) {
  return <Icon name="more" strokeWidth={2.4} size={size} color={color} style={style} />;
}

export function CheckIcon({ size = 18, color = '#4E9F86', style }: IconProps) {
  return <Icon name="check" size={size} color={color} style={style} />;
}

export function PlayIcon({ size = 18, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="play" fill={color} size={size} color={color} style={style} />;
}

export function PauseIcon({ size = 18, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="pause" size={size} color={color} style={style} />;
}

export function PhotoIcon({ size = 20, color = '#E6EAE8', style }: IconProps) {
  return <Icon name="photo" size={size} color={color} style={style} />;
}

export function GoogleIcon({ size = 20, style }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} style={style}>
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </Svg>
  );
}
