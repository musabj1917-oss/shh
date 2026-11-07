import React, { Component, ErrorInfo, ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { mapErrorToUserFriendly, UserFriendlyError } from '@haiku/contracts';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  friendlyError: UserFriendlyError | null;
}

function ErrorBoundaryFallbackView({
  friendly,
  onReset,
}: {
  friendly: UserFriendlyError;
  onReset: () => void;
}) {
  const { colors, typography, radii, controls } = useTheme();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.line,
            borderRadius: radii.xxl,
          },
        ]}
      >
        <View
          style={[
            styles.illustrationOrb,
            {
              backgroundColor: colors.mintWash,
              borderColor: colors.stitchGlow,
            },
          ]}
        >
          <Text style={{ fontSize: 24, color: colors.mint, fontWeight: '800' }}>!</Text>
        </View>

        <Text style={[styles.title, { color: colors.ink }]}>{friendly.title}</Text>
        <Text style={[styles.message, { color: colors.body }]}>{friendly.message}</Text>

        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: colors.mint,
                borderRadius: radii.md,
                height: controls.heights.md,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={onReset}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, { color: colors.mintContrast }]}>Try Again</Text>
          </Pressable>
        </View>

        {friendly.technicalDetails ? (
          <View style={[styles.accordionContainer, { borderTopColor: colors.line }]}>
            <Pressable
              onPress={() => setShowDetails(!showDetails)}
              style={styles.toggleBtn}
              accessibilityRole="button"
            >
              <Text style={[styles.toggleText, { color: colors.muted }]}>
                {showDetails ? 'Hide technical details ▲' : 'Technical details ▼'}
              </Text>
            </Pressable>

            {showDetails ? (
              <View
                style={[
                  styles.detailsBox,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.line,
                    borderRadius: radii.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.detailsText,
                    {
                      color: colors.body,
                      fontFamily: typography.fonts.mono,
                    },
                  ]}
                  selectable
                >
                  {friendly.technicalDetails}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      friendlyError: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      friendlyError: mapErrorToUserFriendly(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  resetError = () => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
      friendlyError: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      const friendly = this.state.friendlyError || {
        title: 'Something Went Wrong',
        message: 'We hit an unexpected snag. Our engineers have been alerted.',
        technicalDetails: this.state.error?.message,
      };

      return <ErrorBoundaryFallbackView friendly={friendly} onReset={this.resetError} />;
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
  },
  illustrationOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    width: '100%',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  accordionContainer: {
    width: '100%',
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 12,
    alignItems: 'center',
  },
  toggleBtn: {
    paddingVertical: 6,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  detailsBox: {
    width: '100%',
    borderWidth: 1,
    padding: 10,
    marginTop: 8,
  },
  detailsText: {
    fontSize: 11,
    lineHeight: 16,
  },
});
