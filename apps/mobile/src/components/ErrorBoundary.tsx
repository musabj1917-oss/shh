import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { mapErrorToUserFriendly, UserFriendlyError } from '@haiku/contracts';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  friendlyError: UserFriendlyError | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      friendlyError: null,
      showDetails: false,
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
      showDetails: false,
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

      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.illustrationOrb}>
              <Text style={{ fontSize: 36 }}>🪐</Text>
            </View>

            <Text style={styles.title}>{friendly.title}</Text>
            <Text style={styles.message}>{friendly.message}</Text>

            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
                onPress={this.resetError}
              >
                <Text style={styles.buttonText}>Try Again</Text>
              </Pressable>
            </View>

            {friendly.technicalDetails ? (
              <View style={styles.accordionContainer}>
                <Pressable
                  onPress={() => this.setState({ showDetails: !this.state.showDetails })}
                  style={styles.toggleBtn}
                >
                  <Text style={styles.toggleText}>
                    {this.state.showDetails ? 'Hide technical details ▲' : 'Technical details ▼'}
                  </Text>
                </Pressable>

                {this.state.showDetails ? (
                  <View style={styles.detailsBox}>
                    <Text style={styles.detailsText} selectable>
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

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f0d',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(23, 23, 23, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 50,
    elevation: 16,
  },
  illustrationOrb: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(153, 227, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(153, 227, 36, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    color: '#d4d4d4',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    width: '100%',
  },
  button: {
    height: 48,
    backgroundColor: '#99e324',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#0d140e',
    fontSize: 14,
    fontWeight: '700',
  },
  accordionContainer: {
    width: '100%',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 12,
    alignItems: 'center',
  },
  toggleBtn: {
    paddingVertical: 4,
  },
  toggleText: {
    color: '#737373',
    fontSize: 12,
    fontWeight: '500',
  },
  detailsBox: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  detailsText: {
    color: '#a3a3a3',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});
