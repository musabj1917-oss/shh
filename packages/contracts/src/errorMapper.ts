export interface UserFriendlyError {
  title: string;
  message: string;
  technicalDetails?: string;
}

/**
 * Translates raw technical exceptions, HTTP statuses, and backend codes
 * into calm, reassuring, and actionable user experiences.
 */
export function mapErrorToUserFriendly(err: unknown): UserFriendlyError {
  let rawMessage = '';
  let status: number | undefined;
  let code: string | undefined;

  if (typeof err === 'string') {
    rawMessage = err;
  } else if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;
    rawMessage = String(anyErr.message || anyErr.error || anyErr.statusText || '');
    if (typeof anyErr.status === 'number') status = anyErr.status;
    if (typeof anyErr.statusCode === 'number') status = anyErr.statusCode;
    if (typeof anyErr.code === 'string') code = anyErr.code;
    if (anyErr.error && typeof anyErr.error === 'object') {
      const sub = anyErr.error as Record<string, unknown>;
      if (typeof sub.message === 'string') rawMessage = sub.message;
      if (typeof sub.code === 'string') code = sub.code;
    }
  }

  const normalized = (rawMessage + ' ' + (code || '')).toLowerCase();
  const techDetails = (code ? `[Code: ${code}] ` : '') + (status ? `[HTTP ${status}] ` : '') + (rawMessage || (typeof err === 'string' ? err : JSON.stringify(err)));

  // 1. Storage & Buckets
  if (normalized.includes('storage') || normalized.includes('bucket') || normalized.includes('s3') || normalized.includes('neon-s3')) {
    return {
      title: 'File Service Temporarily Unavailable',
      message: "We can't connect to file storage at the moment. Your files are safe, but uploads and downloads are paused.",
      technicalDetails: techDetails,
    };
  }

  // 2. Connectivity & Offline
  if (
    normalized.includes('networkerror') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('offline') ||
    normalized.includes('network request failed') ||
    normalized.includes('enotfound') ||
    normalized.includes('econnrefused') ||
    normalized.includes('etimedout')
  ) {
    return {
      title: 'Unable to Connect',
      message: 'Check your internet connection and try again.',
      technicalDetails: techDetails,
    };
  }

  // 3. Auth & Session Expiry
  if (
    status === 401 ||
    normalized.includes('401') ||
    normalized.includes('jwt expired') ||
    normalized.includes('token expired') ||
    normalized.includes('unauthorized') ||
    code === 'INVALID_CREDENTIALS' ||
    code === 'UNAUTHORIZED'
  ) {
    return {
      title: 'Session Expired',
      message: 'Please sign in again to continue.',
      technicalDetails: techDetails,
    };
  }

  // 4. Email Unverified
  if (code === 'EMAIL_UNVERIFIED' || normalized.includes('email_unverified') || normalized.includes('verify your email')) {
    return {
      title: 'Email Verification Required',
      message: 'Please verify your email address before signing in. Check your inbox for the confirmation link.',
      technicalDetails: techDetails,
    };
  }

  // 5. Date of Birth Regex Format
  if (normalized.includes('\\d{4}-\\d{2}-\\d{2}') || normalized.includes('yyy-mm-dd') || normalized.includes('iso date')) {
    return {
      title: 'Invalid Date Format',
      message: 'Please enter your date of birth in YYYY-MM-DD format (for example, 2000-12-01).',
      technicalDetails: techDetails,
    };
  }

  // 6. Age Restriction
  if (normalized.includes('at least 13') || normalized.includes('minimum age')) {
    return {
      title: 'Age Requirement',
      message: 'You need to be at least 13 years old to create an account on Haiku Messenger.',
      technicalDetails: techDetails,
    };
  }

  // 7. Password requirements
  if (normalized.includes('password') && (normalized.includes('12') || normalized.includes('character') || normalized.includes('short'))) {
    return {
      title: 'Password Requirements',
      message: 'Your password must be at least 12 characters long.',
      technicalDetails: techDetails,
    };
  }

  // 8. Permissions / 403 Forbidden
  if (status === 403 || normalized.includes('forbidden') || normalized.includes('not allowed')) {
    return {
      title: 'Access Restricted',
      message: "You don't have permission to perform this action.",
      technicalDetails: techDetails,
    };
  }

  // 9. Not Found / 404
  if (status === 404 || normalized.includes('not found') || code === 'USER_NOT_FOUND' || code === 'NOT_FOUND') {
    return {
      title: 'Item Not Found',
      message: 'The requested conversation, user, or resource is no longer available.',
      technicalDetails: techDetails,
    };
  }

  // 10. Rate limiting / 429
  if (status === 429 || normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return {
      title: 'Slow Down a Bit',
      message: 'You have made too many requests in a short time. Please take a breath and try again shortly.',
      technicalDetails: techDetails,
    };
  }

  // 11. Default fallback for unknown 500 / server / uncaught errors
  return {
    title: 'Something Went Wrong',
    message: 'We hit an unexpected snag. Our engineers have been alerted.',
    technicalDetails: techDetails,
  };
}
