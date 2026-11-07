import React, { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import type { LinkingOptions, Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList, RootStackParamList } from './types';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { AuthScreen } from '../screens/AuthScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { GroupDetailScreen } from '../screens/GroupDetailScreen';
import { StoriesScreen } from '../screens/StoriesScreen';
import { StoryViewScreen } from '../screens/StoryViewScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { PublicProfileScreen } from '../screens/PublicProfileScreen';
import { JoinGroupScreen } from '../screens/JoinGroupScreen';
import { takePendingInvite } from '../invites';
import { BrandMark } from '../components/UI';
import { ChatsIcon, MomentsIcon, PeopleIcon, SettingsIcon } from '../components/Icons';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['haikumessenger://'],
  config: { screens: { JoinGroup: 'join/:token' } },
};

function renderTabIcon(routeName: string, focused: boolean, color: string, size = 22) {
  switch (routeName) {
    case 'Inbox':
      return <ChatsIcon size={size} color={color} />;
    case 'Stories':
      return <MomentsIcon size={size} color={color} />;
    case 'People':
      return <PeopleIcon size={size} color={color} />;
    case 'Profile':
      return <SettingsIcon size={size} color={color} />;
    default:
      return null;
  }
}

/**
 * Modern Native Bottom Navigation Bar for Mobile Phones
 */
function BottomTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors, radii } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.panelSolid,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 8,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
      }}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const iconColor = isFocused ? colors.mint : colors.muted;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={typeof label === 'string' ? label : route.name}
            style={({ pressed }) => [
              {
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 4,
                paddingHorizontal: 6,
                minHeight: 48,
                borderRadius: radii.lg,
                borderCurve: 'continuous',
                backgroundColor: isFocused ? colors.mintWash : 'transparent',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <View style={{ marginBottom: 2 }}>
              {renderTabIcon(route.name, isFocused, iconColor, 22)}
            </View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: isFocused ? '700' : '500',
                color: isFocused ? colors.ink : colors.muted,
                letterSpacing: 0.1,
              }}
            >
              {typeof label === 'string' ? label : route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Adaptive Navigation Rail for Wide Screens / Landscape Tablets (>= 768px)
 */
function LeftNavRail({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors, radii } = useTheme();

  return (
    <View
      style={{
        width: 76 + insets.left,
        paddingLeft: insets.left,
        paddingRight: 0,
        paddingTop: Math.max(insets.top, 14),
        paddingBottom: Math.max(insets.bottom, 14),
        backgroundColor: colors.panel,
        borderRightWidth: 1,
        borderRightColor: colors.line,
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
      }}
    >
      <View style={{ alignItems: 'center', gap: 14 }}>
        <BrandMark size={38} />
        <View style={{ width: 32, height: 1, backgroundColor: colors.line }} />
      </View>

      <View style={{ gap: 12, alignItems: 'center' }}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const iconColor = isFocused ? colors.mint : colors.muted;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={typeof label === 'string' ? label : route.name}
              style={({ pressed }) => [
                {
                  width: 58,
                  height: 54,
                  borderRadius: radii.lg,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isFocused
                    ? colors.mintWash
                    : pressed
                    ? colors.line
                    : 'transparent',
                  borderWidth: 1,
                  borderColor: isFocused ? colors.stitchGlow : 'transparent',
                },
              ]}
            >
              {renderTabIcon(route.name, isFocused, iconColor, 22)}
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: isFocused ? '700' : '500',
                  color: isFocused ? colors.mint : colors.muted,
                  marginTop: 3,
                  letterSpacing: 0.1,
                }}
              >
                {typeof label === 'string' ? label : route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ alignItems: 'center', gap: 6 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.mint,
            opacity: 0.85,
          }}
        />
      </View>
    </View>
  );
}

function MainTabs() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  return (
    <Tabs.Navigator
      tabBar={(props) => (isTablet ? <LeftNavRail {...props} /> : <BottomTabBar {...props} />)}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isTablet ? 'left' : 'bottom',
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen name="Inbox" component={InboxScreen} options={{ tabBarLabel: 'Chats' }} />
      <Tabs.Screen name="Stories" component={StoriesScreen} options={{ tabBarLabel: 'Moments' }} />
      <Tabs.Screen name="People" component={FriendsScreen} options={{ tabBarLabel: 'People' }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Settings' }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading } = useAuth();
  const { colors, isDark } = useTheme();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  const openPendingInvite = useCallback(() => {
    const token = takePendingInvite();
    if (token && navigationRef.isReady()) navigationRef.navigate('JoinGroup', { token });
  }, [navigationRef]);

  useEffect(() => {
    if (user) openPendingInvite();
  }, [user, openPendingInvite]);

  const navTheme = useMemo<NavTheme>(
    () => ({
      dark: isDark,
      colors: {
        primary: colors.mint,
        background: colors.canvas,
        card: colors.panelSolid,
        text: colors.ink,
        border: colors.line,
        notification: colors.red,
      },
      fonts: {
        regular: { fontFamily: 'sans-serif', fontWeight: 'normal' },
        medium: { fontFamily: 'sans-serif-medium', fontWeight: 'normal' },
        bold: { fontFamily: 'sans-serif', fontWeight: 'bold' },
        heavy: { fontFamily: 'sans-serif', fontWeight: '900' },
      },
    }),
    [colors, isDark]
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.canvas,
        }}
      >
        <BrandMark size={52} />
        <ActivityIndicator size="small" color={colors.mint} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme} linking={linking} ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'fade_from_bottom',
        }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen name="Groups" component={GroupsScreen} />
            <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
            <Stack.Screen
              name="StoryView"
              component={StoryViewScreen}
              options={{ animation: 'fade' }}
            />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
            <Stack.Screen name="JoinGroup" component={JoinGroupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
