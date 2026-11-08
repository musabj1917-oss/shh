import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Keyboard,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  emailSchema,
  loginSchema,
  mapErrorToUserFriendly,
  meetsMinimumAge,
  registerSchema,
  usernameSchema,
} from '@haiku/contracts';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { api, messageForError } from '../api/client';
import { BrandMark, Button, Field, Notice, Screen, Surface } from '../components/UI';
import { CheckIcon, CloseIcon, GoogleIcon, PlusIcon } from '../components/Icons';
import { useTheme } from '../theme/ThemeContext';
import {
  ONBOARDING_COMPLETED_KEY,
  OnboardingSlider,
} from '../components/OnboardingSlider';
import { MEDIA_LIMITS, validateMediaSize } from '../constants/mediaLimits';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export function AuthScreen({ navigation }: Props) {
  const { signIn, signInWithGoogle, register } = useAuth();
  const { colors, radii, controls } = useTheme();
  const insets = useSafeAreaInsets();

  // Google sign in state
  const [googlePendingToken, setGooglePendingToken] = useState<string | null>(null);
  const [showGoogleInput, setShowGoogleInput] = useState(false);
  const [googleManualToken, setGoogleManualToken] = useState('');

  // Onboarding state
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    async function checkFirstLaunch() {
      try {
        const completed = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
        if (completed !== 'true') {
          setShowOnboarding(true);
        }
      } catch (err) {
        console.warn('Could not read onboarding state:', err);
      } finally {
        setCheckingOnboarding(false);
      }
    }
    void checkFirstLaunch();
  }, []);

  const handleFinishOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch {}
    setShowOnboarding(false);
  };

  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Username availability state
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [usernameMessage, setUsernameMessage] = useState('');

  // UI state
  const [error, setError] = useState('');
  const [stepError, setStepError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  // Slide animation between steps
  const slideAnim = useRef(new Animated.Value(0)).current;

  const triggerSlideAnimation = (direction: 'next' | 'back') => {
    slideAnim.setValue(direction === 'next' ? 40 : -40);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: colors.muted };
    if (pass.length < 8) {
      return { score: 1, label: 'Too short (min 8)', color: '#EF4444' };
    }
    if (pass.length < 12) {
      return { score: 2, label: 'Fair (12+ recommended)', color: '#F59E0B' };
    }
    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSymbols = /[^a-zA-Z0-9]/.test(pass);
    const varietyCount = [hasLetters, hasNumbers, hasSymbols].filter(Boolean).length;

    if (varietyCount >= 3 || pass.length >= 16) {
      return { score: 4, label: 'Very Strong', color: '#10B981' };
    }
    if (varietyCount >= 2) {
      return { score: 3, label: 'Strong', color: '#10B981' };
    }
    return { score: 2, label: 'Good', color: '#3B82F6' };
  };

  // Live debounced username check
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkUsernameAvailability = useCallback(
    async (rawName: string) => {
      const trimmed = rawName.trim().toLowerCase();
      if (!trimmed) {
        setUsernameStatus('idle');
        setUsernameMessage('');
        return;
      }

      const formatCheck = usernameSchema.safeParse(trimmed);
      if (!formatCheck.success) {
        setUsernameStatus('invalid');
        setUsernameMessage('Use 3–24 letters, numbers, or underscores.');
        return;
      }

      setUsernameStatus('checking');
      setUsernameMessage('Checking availability…');

      try {
        const res = await api<{ available: boolean }>(
          `/profile/username-available?username=${encodeURIComponent(trimmed)}`,
          { anonymous: true }
        );
        if (res.available) {
          setUsernameStatus('available');
          setUsernameMessage(`@${trimmed} is available`);
        } else {
          setUsernameStatus('taken');
          setUsernameMessage(`@${trimmed} is already taken`);
        }
      } catch {
        // If unauthenticated or backend probe returns 401, format check is valid
        setUsernameStatus('available');
        setUsernameMessage(`Format valid: @${trimmed}`);
      }
    },
    []
  );

  const handleUsernameChange = (text: string) => {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    setStepError('');

    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    usernameTimerRef.current = setTimeout(() => {
      void checkUsernameAvailability(cleaned);
    }, 350);
  };

  // Avatar picker for step 5
  const pickAvatar = async () => {
    setStepError('');
    const picked = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: MEDIA_LIMITS.AVATAR.COMPRESSION_QUALITY,
      maxWidth: MEDIA_LIMITS.AVATAR.MAX_WIDTH,
      maxHeight: MEDIA_LIMITS.AVATAR.MAX_HEIGHT,
    });
    if (picked.didCancel) return;
    if (picked.errorCode) {
      setStepError(picked.errorMessage || 'Could not open photo library.');
      return;
    }
    const asset = picked.assets?.[0];
    if (!asset?.uri) return;

    if (asset.fileSize) {
      const check = validateMediaSize('avatar', asset.fileSize);
      if (!check.valid && check.error) {
        setStepError(check.error);
        return;
      }
    }
    setAvatarUri(asset.uri);
  };

  // Step Validation & Navigation
  const validateAndProceedStep = async () => {
    setStepError('');
    setError('');

    if (currentStep === 1) {
      const emailValue = email.trim().toLowerCase();
      const check = emailSchema.safeParse(emailValue);
      if (!check.success) {
        setStepError('Please enter a valid email address.');
        return;
      }
      setCurrentStep(2);
      triggerSlideAnimation('next');
      return;
    }

    if (currentStep === 2) {
      if (password.length < 8) {
        setStepError('Password must be at least 8 characters.');
        return;
      }
      if (password.length < 12) {
        setStepError('For server security, please choose at least 12 characters.');
        return;
      }
      setCurrentStep(3);
      triggerSlideAnimation('next');
      return;
    }

    if (currentStep === 3) {
      const name = username.trim().toLowerCase();
      const check = usernameSchema.safeParse(name);
      if (!check.success) {
        setStepError('Username must be 3–24 letters, numbers, or underscores.');
        return;
      }
      if (usernameStatus === 'taken') {
        setStepError('That username is already taken. Please choose another.');
        return;
      }
      setCurrentStep(4);
      triggerSlideAnimation('next');
      return;
    }

    if (currentStep === 4) {
      const normalizedDob = dateOfBirth.trim().replace(/[/.\s]/g, '-');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDob)) {
        setStepError('Enter birth date in YYYY-MM-DD format (e.g. 2002-05-18).');
        return;
      }
      if (!meetsMinimumAge(normalizedDob)) {
        setStepError('You must be at least 13 years old to create a Haiku account.');
        return;
      }
      setDateOfBirth(normalizedDob);
      setCurrentStep(5);
      triggerSlideAnimation('next');
      return;
    }

    if (currentStep === 5) {
      setCurrentStep(6);
      triggerSlideAnimation('next');
      return;
    }

    if (currentStep === 6) {
      if (!agreedToTerms) {
        setStepError('Please agree to the Terms of Service and Privacy Policy to continue.');
        return;
      }
      await completeRegistration();
    }
  };

  const handleStepBack = () => {
    setStepError('');
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
      triggerSlideAnimation('back');
    } else {
      setMode('login');
    }
  };

  // Sign In Submission
  const submitLogin = async () => {
    setError('');
    setInfo('');
    const emailValue = email.trim().toLowerCase();
    const parsed = loginSchema.safeParse({ email: emailValue, password });
    if (!parsed.success) {
      setError(mapErrorToUserFriendly(parsed.error.issues[0]?.message).message);
      return;
    }
    setBusy(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
    } catch (e) {
      setError(mapErrorToUserFriendly(e).message);
    } finally {
      setBusy(false);
    }
  };

  // Google Sign-In Flow
  const handleGoogleSignIn = async (tokenOverride?: string) => {
    setError('');
    setStepError('');
    setBusy(true);
    try {
      try {
        const health = await api<{ googleSignInConfigured: boolean }>('/health', { anonymous: true });
        if (!health?.googleSignInConfigured && !tokenOverride && !googleManualToken) {
          setError('Google Sign-In is ready in code, but requires GOOGLE_CLIENT_ID configured on the server.');
          setBusy(false);
          return;
        }
      } catch {}

      const idToken = tokenOverride || googleManualToken;
      if (!idToken) {
        setShowGoogleInput(true);
        setBusy(false);
        return;
      }

      const res = await signInWithGoogle({ idToken });
      if (res.registrationRequired) {
        setGooglePendingToken(idToken);
        setMode('register');
        if (res.verifiedEmail) setEmail(res.verifiedEmail);
        if (res.displayName) setDisplayName(res.displayName);
        setCurrentStep(3); // Direct jump to username selection
        triggerSlideAnimation('next');
        setInfo('Google account verified! Please choose a username and birth date (13+).');
      } else {
        setInfo('Signed in successfully with Google.');
      }
    } catch (e) {
      setError(messageForError(e, 'Google sign-in failed.'));
    } finally {
      setBusy(false);
    }
  };

  // Complete Registration
  const completeRegistration = async () => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const emailValue = email.trim().toLowerCase();
      const normalizedDob = dateOfBirth.trim().replace(/[/.\s]/g, '-');

      if (googlePendingToken) {
        const res = await signInWithGoogle({
          idToken: googlePendingToken,
          username: username.trim().toLowerCase(),
          dateOfBirth: normalizedDob,
          displayName: displayName.trim() || username.trim(),
        });
        if (res.accessToken) {
          setInfo('Welcome to Haiku!');
        }
        return;
      }

      const input = {
        email: emailValue,
        password,
        username: username.trim().toLowerCase(),
        displayName: displayName.trim() || username.trim(),
        dateOfBirth: normalizedDob,
      };

      const parsed = registerSchema.safeParse(input);
      if (!parsed.success) {
        setError(mapErrorToUserFriendly(parsed.error.issues[0]?.message).message);
        setBusy(false);
        return;
      }

      const result = await register(parsed.data);
      setInfo(`${result.message} Please check your inbox to verify your email.`);
      setMode('login');
      setCurrentStep(1);
    } catch (e) {
      setError(mapErrorToUserFriendly(e).message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const result = await api<{ message: string }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify(email.trim().toLowerCase()),
        anonymous: true,
      });
      setInfo(result.message);
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  };

  if (checkingOnboarding) {
    return null;
  }

  if (showOnboarding) {
    return <OnboardingSlider onComplete={handleFinishOnboarding} />;
  }

  const isRegister = mode === 'register';
  const pwdStrength = getPasswordStrength(password);

  return (
    <Screen scroll style={{ backgroundColor: colors.canvas }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <View
          style={{
            paddingHorizontal: 22,
            paddingTop: 32,
            paddingBottom: keyboardOpen ? 16 : Math.max(insets.bottom, 36),
            maxWidth: 520,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          {/* Hero Header */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View
              style={{
                shadowColor: colors.mint,
                shadowOpacity: 0.35,
                shadowRadius: 20,
                elevation: 6,
                marginBottom: 14,
              }}
            >
              <BrandMark size={56} />
            </View>
            <Text
              style={{
                color: colors.ink,
                fontWeight: '800',
                fontSize: 28,
                letterSpacing: -0.7,
                textAlign: 'center',
              }}
            >
              haiku
            </Text>
            <Text
              style={{
                color: colors.mint,
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 2,
                marginTop: 2,
                textTransform: 'uppercase',
              }}
            >
              Calm &bull; Ephemeral &bull; Connected
            </Text>
          </View>

          {/* Mode Selector */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.panel,
              padding: 4,
              borderRadius: radii.xl,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: colors.line,
              marginBottom: 18,
            }}
          >
            <Pressable
              onPress={() => {
                setError('');
                setStepError('');
                setInfo('');
                setMode('login');
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: !isRegister }}
              style={({ pressed }) => [
                {
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: radii.lg,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: controls.heights.sm,
                  backgroundColor: !isRegister ? colors.mint : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: !isRegister ? colors.mintContrast : colors.muted,
                }}
              >
                Sign In
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setError('');
                setStepError('');
                setInfo('');
                setMode('register');
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isRegister }}
              style={({ pressed }) => [
                {
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: radii.lg,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: controls.heights.sm,
                  backgroundColor: isRegister ? colors.mint : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: isRegister ? colors.mintContrast : colors.muted,
                }}
              >
                Create Account
              </Text>
            </Pressable>
          </View>

          {error ? <Notice tone="error">{error}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}

          {/* MAIN CARD CONTAINER */}
          <Surface
            style={{
              padding: 22,
              borderRadius: radii.xxl,
              borderCurve: 'continuous',
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            {/* LOGIN FORM (Single short form) */}
            {!isRegister ? (
              <View>
                <Field
                  label="Email"
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    setError('');
                  }}
                  placeholder="name@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  returnKeyType="next"
                />

                <Field
                  label="Password"
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    setError('');
                  }}
                  placeholder="Enter password"
                  secureTextEntry
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={submitLogin}
                />

                <Button
                  title="Sign In"
                  onPress={submitLogin}
                  loading={busy}
                  style={{ marginTop: 8 }}
                />

                <Pressable
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={({ pressed }) => [
                    {
                      alignSelf: 'center',
                      paddingVertical: 14,
                      minHeight: controls.heights.sm,
                      justifyContent: 'center',
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.mint,
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                  >
                    Forgot your password?
                  </Text>
                </Pressable>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginVertical: 10,
                  }}
                >
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      color: colors.muted,
                    }}
                  >
                    or
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
                </View>

                <Pressable
                  onPress={() => void handleGoogleSignIn()}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      height: controls.heights.md,
                      borderRadius: radii.md,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.line,
                      opacity: pressed || busy ? 0.75 : 1,
                    },
                  ]}
                >
                  <GoogleIcon size={18} />
                  <Text
                    style={{
                      color: colors.ink,
                      fontSize: 14,
                      fontWeight: '700',
                    }}
                  >
                    Continue with Google
                  </Text>
                </Pressable>

                {showGoogleInput ? (
                  <View
                    style={{
                      marginTop: 12,
                      padding: 12,
                      borderRadius: radii.md,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.line,
                    }}
                  >
                    <Field
                      label="Google ID Token"
                      value={googleManualToken}
                      onChangeText={setGoogleManualToken}
                      placeholder="Paste Google JWT id_token"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Button
                      title="Verify & Continue"
                      onPress={() => void handleGoogleSignIn(googleManualToken)}
                      loading={busy}
                      disabled={!googleManualToken.trim()}
                      style={{ marginTop: 8 }}
                    />
                  </View>
                ) : null}
              </View>
            ) : (
              /* STEP-BY-STEP SIGN UP WIZARD */
              <Animated.View
                style={{
                  transform: [{ translateX: slideAnim }],
                }}
              >
                {/* Step Progress Bar */}
                <View style={{ marginBottom: 16 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color: colors.mint,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                      }}
                    >
                      Step {currentStep} of 6
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      {currentStep === 1
                        ? 'Email'
                        : currentStep === 2
                        ? 'Password'
                        : currentStep === 3
                        ? 'Username'
                        : currentStep === 4
                        ? 'Birthday'
                        : currentStep === 5
                        ? 'Profile'
                        : 'Review & Terms'}
                    </Text>
                  </View>

                  <View
                    style={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.line,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${(currentStep / 6) * 100}%`,
                        backgroundColor: colors.mint,
                      }}
                    />
                  </View>
                </View>

                {stepError ? (
                  <View style={{ marginBottom: 12 }}>
                    <Notice tone="error">{stepError}</Notice>
                  </View>
                ) : null}

                {/* STEP 1: EMAIL */}
                {currentStep === 1 && (
                  <View>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '800',
                        color: colors.ink,
                        marginBottom: 4,
                      }}
                    >
                      What is your email?
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.body,
                        lineHeight: 18,
                        marginBottom: 16,
                      }}
                    >
                      We will send a confidential link to verify your account.
                    </Text>

                    <Field
                      label="Email address"
                      value={email}
                      onChangeText={(val) => {
                        setEmail(val);
                        setStepError('');
                      }}
                      placeholder="you@domain.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="emailAddress"
                      returnKeyType="next"
                      onSubmitEditing={validateAndProceedStep}
                    />

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        marginVertical: 14,
                      }}
                    >
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                          color: colors.muted,
                        }}
                      >
                        or
                      </Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
                    </View>

                    <Pressable
                      onPress={() => void handleGoogleSignIn()}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel="Sign up with Google"
                      style={({ pressed }) => [
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 10,
                          height: controls.heights.md,
                          borderRadius: radii.md,
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.line,
                          opacity: pressed || busy ? 0.75 : 1,
                        },
                      ]}
                    >
                      <GoogleIcon size={18} />
                      <Text
                        style={{
                          color: colors.ink,
                          fontSize: 14,
                          fontWeight: '700',
                        }}
                      >
                        Sign up with Google
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* STEP 2: PASSWORD */}
                {currentStep === 2 && (
                  <View>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '800',
                        color: colors.ink,
                        marginBottom: 4,
                      }}
                    >
                      Create a secure password
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.body,
                        lineHeight: 18,
                        marginBottom: 16,
                      }}
                    >
                      Minimum 12 characters. Use a passphrase with words, numbers, or symbols.
                    </Text>

                    <Field
                      label="Password"
                      value={password}
                      onChangeText={(val) => {
                        setPassword(val);
                        setStepError('');
                      }}
                      placeholder="At least 12 characters"
                      secureTextEntry
                      textContentType="newPassword"
                      returnKeyType="next"
                      onSubmitEditing={validateAndProceedStep}
                    />

                    {/* Password Strength Indicator */}
                    {password.length > 0 && (
                      <View style={{ marginTop: -8, marginBottom: 14 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 4,
                          }}
                        >
                          <Text style={{ fontSize: 11, color: colors.muted }}>
                            Strength:
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: pwdStrength.color,
                            }}
                          >
                            {pwdStrength.label}
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: 'row',
                            gap: 4,
                            height: 4,
                          }}
                        >
                          {[1, 2, 3, 4].map((bar) => (
                            <View
                              key={bar}
                              style={{
                                flex: 1,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor:
                                  bar <= pwdStrength.score
                                    ? pwdStrength.color
                                    : colors.line,
                              }}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* STEP 3: USERNAME */}
                {currentStep === 3 && (
                  <View>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '800',
                        color: colors.ink,
                        marginBottom: 4,
                      }}
                    >
                      Choose your handle
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.body,
                        lineHeight: 18,
                        marginBottom: 16,
                      }}
                    >
                      Your unique identifier across Haiku. 3–24 letters, numbers, or underscores.
                    </Text>

                    <Field
                      label="Username"
                      value={username}
                      onChangeText={handleUsernameChange}
                      placeholder="your_handle"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={24}
                      returnKeyType="next"
                      onSubmitEditing={validateAndProceedStep}
                    />

                    {/* Live availability badge */}
                    {usernameMessage ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: -6,
                          marginBottom: 14,
                        }}
                      >
                        {usernameStatus === 'available' ? (
                          <CheckIcon size={14} color="#10B981" />
                        ) : usernameStatus === 'taken' || usernameStatus === 'invalid' ? (
                          <CloseIcon size={14} color="#EF4444" />
                        ) : null}
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '600',
                            color:
                              usernameStatus === 'available'
                                ? '#10B981'
                                : usernameStatus === 'checking'
                                ? colors.muted
                                : '#EF4444',
                          }}
                        >
                          {usernameMessage}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* STEP 4: DATE OF BIRTH */}
                {currentStep === 4 && (
                  <View>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '800',
                        color: colors.ink,
                        marginBottom: 4,
                      }}
                    >
                      When were you born?
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.body,
                        lineHeight: 18,
                        marginBottom: 16,
                      }}
                    >
                      You must be at least 13 to use Haiku. Your birth year is strictly private and never published.
                    </Text>

                    <Field
                      label="Birth date (YYYY-MM-DD)"
                      value={dateOfBirth}
                      onChangeText={(val) => {
                        setDateOfBirth(val);
                        setStepError('');
                      }}
                      placeholder="2002-06-15"
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                      returnKeyType="next"
                      onSubmitEditing={validateAndProceedStep}
                    />
                  </View>
                )}

                {/* STEP 5: DISPLAY NAME & AVATAR (OPTIONAL) */}
                {currentStep === 5 && (
                  <View>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '800',
                        color: colors.ink,
                        marginBottom: 4,
                      }}
                    >
                      Set up your profile
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.body,
                        lineHeight: 18,
                        marginBottom: 16,
                      }}
                    >
                      How friends see your name. Profile photo is optional (max {MEDIA_LIMITS.AVATAR.MAX_LABEL}).
                    </Text>

                    <Field
                      label="Display name (optional)"
                      value={displayName}
                      onChangeText={setDisplayName}
                      placeholder={username || 'Your display name'}
                      maxLength={60}
                      autoCapitalize="words"
                      returnKeyType="done"
                    />

                    {/* Avatar picker preview */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 16,
                        marginVertical: 10,
                        padding: 12,
                        borderRadius: radii.xl,
                        backgroundColor: colors.panel,
                        borderWidth: 1,
                        borderColor: colors.line,
                      }}
                    >
                      <Pressable
                        onPress={pickAvatar}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.stitchGlow,
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {avatarUri ? (
                          <Image
                            source={{ uri: avatarUri }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                        ) : (
                          <PlusIcon size={20} color={colors.mint} />
                        )}
                      </Pressable>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: '700',
                            color: colors.ink,
                          }}
                        >
                          {avatarUri ? 'Photo selected' : 'Add Profile Photo'}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.muted }}>
                          {avatarUri
                            ? 'Tap to change photo'
                            : `Optional image • Max ${MEDIA_LIMITS.AVATAR.MAX_LABEL}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* STEP 6: TERMS & CREATE ACCOUNT */}
                {currentStep === 6 && (
                  <View>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '800',
                        color: colors.ink,
                        marginBottom: 4,
                      }}
                    >
                      Terms of Service
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.body,
                        lineHeight: 18,
                        marginBottom: 16,
                      }}
                    >
                      Haiku is dedicated to calm, quiet, and private conversation.
                    </Text>

                    <View
                      style={{
                        padding: 14,
                        borderRadius: radii.xl,
                        backgroundColor: colors.panel,
                        borderWidth: 1,
                        borderColor: colors.line,
                        marginBottom: 16,
                        gap: 8,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: colors.body, lineHeight: 18 }}>
                        • Ephemeral messaging by default
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.body, lineHeight: 18 }}>
                        • No ads, profiling, or data brokerage
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.body, lineHeight: 18 }}>
                        • Respectful community guidelines enforced
                      </Text>
                    </View>

                    {/* Agreement Toggle */}
                    <Pressable
                      onPress={() => setAgreedToTerms((prev) => !prev)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingVertical: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: radii.sm,
                          borderWidth: 1.5,
                          borderColor: agreedToTerms ? colors.mint : colors.muted,
                          backgroundColor: agreedToTerms ? colors.mint : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {agreedToTerms ? (
                          <CheckIcon size={14} color={colors.mintContrast} />
                        ) : null}
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 12,
                          color: colors.ink,
                          lineHeight: 16,
                        }}
                      >
                        I agree to Haiku's Terms of Service and Privacy Policy.
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* Navigation Buttons for Wizard */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 18,
                  }}
                >
                  <Button
                    title="Back"
                    kind="secondary"
                    onPress={handleStepBack}
                    style={{ flex: 1 }}
                  />

                  <Button
                    title={
                      currentStep === 6
                        ? 'Create Account'
                        : currentStep === 5
                        ? displayName || avatarUri
                          ? 'Next'
                          : 'Skip'
                        : 'Next'
                    }
                    onPress={validateAndProceedStep}
                    loading={busy}
                    style={{ flex: 2 }}
                  />
                </View>
              </Animated.View>
            )}
          </Surface>

          {/* Resend Verification notice */}
          {error.includes('EMAIL_UNVERIFIED') ||
          error.toLowerCase().includes('verify your email') ? (
            <Button
              title="Resend verification email"
              kind="secondary"
              onPress={resend}
              loading={busy}
              style={{ marginTop: 14 }}
            />
          ) : null}

          {/* Footer toggle */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              marginTop: 22,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {isRegister ? 'Already have an account?' : 'Need an account?'}
            </Text>
            <Pressable
              onPress={() => {
                setError('');
                setStepError('');
                setInfo('');
                setMode(isRegister ? 'login' : 'register');
                setCurrentStep(1);
              }}
              style={({ pressed }) => [
                { minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={{ color: colors.mint, fontSize: 13, fontWeight: '800' }}>
                {isRegister ? 'Sign in' : 'Create one'}
              </Text>
            </Pressable>
          </View>

          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <Text
              style={{
                color: colors.muted,
                fontSize: 11,
                letterSpacing: 0.3,
              }}
            >
              Quiet, weightless, authentic conversation.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
