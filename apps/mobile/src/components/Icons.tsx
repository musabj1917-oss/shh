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
