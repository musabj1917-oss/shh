import { AppState, NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { requestPermission } from '../permissions';

export interface RecordedAudio {
  uri: string;
  filePath?: string;
  durationMs: number;
  durationSec: number;
  byteSize: number;
  mimeType: string;
  blob?: Blob;
}

export interface PlaybackStatus {
  isPlaying: boolean;
  currentPositionMs: number;
  durationMs: number;
}

const { HaikuVoice } = NativeModules;
const voiceEmitter = HaikuVoice ? new NativeEventEmitter(HaikuVoice) : null;

// Web MediaRecorder state
let webMediaRecorder: any = null;
let webAudioChunks: Blob[] = [];
let webRecordingStartTime = 0;
let webStream: any = null;
let webAudioPlayer: any = null;

let appStateSubscription: any = null;
let onInterruptionCallback: (() => void) | null = null;

export function setInterruptionHandler(handler: (() => void) | null) {
  onInterruptionCallback = handler;
}

export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  const result = await requestPermission('microphone');
  return result === 'granted';
}

export async function startVoiceRecording(): Promise<{ uri?: string; error?: string }> {
  const hasPermission = await requestMicrophonePermission();
  if (!hasPermission) {
    return {
      error:
        'Microphone permission was denied. Please allow microphone access in device settings to record voice notes.',
    };
  }

  // Set up interruption listener (phone calls, app backgrounded)
  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        void cancelVoiceRecording();
        onInterruptionCallback?.();
      }
    });
  }

  if (Platform.OS === 'web') {
    try {
      webAudioChunks = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      webStream = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) {
          webAudioChunks.push(e.data);
        }
      };
      recorder.start(100);
      webMediaRecorder = recorder;
      webRecordingStartTime = Date.now();
      return {};
    } catch (err: any) {
      return { error: err.message || 'Failed to start web audio recording' };
    }
  }

  if (!HaikuVoice) {
    return { error: 'Native audio recording module is not available.' };
  }

  try {
    const res = await HaikuVoice.startRecording();
    return { uri: res.uri };
  } catch (err: any) {
    return { error: err.message || 'Could not start audio recording' };
  }
}

export async function stopVoiceRecording(): Promise<RecordedAudio> {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  if (Platform.OS === 'web') {
    if (!webMediaRecorder) {
      throw new Error('Recording was not active.');
    }
    return new Promise((resolve, reject) => {
      webMediaRecorder.onstop = () => {
        const mimeType = webMediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(webAudioChunks, { type: mimeType });
        const durationMs = Math.max(500, Date.now() - webRecordingStartTime);
        const uri = URL.createObjectURL(blob);

        if (webStream) {
          webStream.getTracks().forEach((t: any) => t.stop());
          webStream = null;
        }
        webMediaRecorder = null;
        webAudioChunks = [];

        resolve({
          uri,
          durationMs,
          durationSec: durationMs / 1000,
          byteSize: blob.size,
          mimeType: 'audio/webm',
          blob,
        });
      };
      try {
        webMediaRecorder.stop();
      } catch (e) {
        reject(e);
      }
    });
  }

  if (!HaikuVoice) {
    throw new Error('Native audio recording module is not available.');
  }

  const res = await HaikuVoice.stopRecording();
  return {
    uri: res.uri,
    filePath: res.filePath,
    durationMs: Number(res.durationMs) || 0,
    durationSec: Number(res.durationSec) || (Number(res.durationMs) || 0) / 1000,
    byteSize: Number(res.byteSize) || 0,
    mimeType: res.mimeType || 'audio/mp4',
  };
}

export async function cancelVoiceRecording(): Promise<void> {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  if (Platform.OS === 'web') {
    if (webMediaRecorder && webMediaRecorder.state !== 'inactive') {
      try {
        webMediaRecorder.stop();
      } catch {}
    }
    if (webStream) {
      webStream.getTracks().forEach((t: any) => t.stop());
      webStream = null;
    }
    webMediaRecorder = null;
    webAudioChunks = [];
    return;
  }

  if (HaikuVoice) {
    try {
      await HaikuVoice.cancelRecording();
    } catch {}
  }
}

export async function playVoiceAudio(
  urlOrUri: string,
  onComplete?: () => void,
  onError?: (err: any) => void
): Promise<{ durationMs: number }> {
  if (Platform.OS === 'web') {
    if (webAudioPlayer) {
      webAudioPlayer.pause();
      webAudioPlayer = null;
    }
    const audio = new Audio(urlOrUri);
    webAudioPlayer = audio;
    audio.onended = () => {
      webAudioPlayer = null;
      onComplete?.();
    };
    audio.onerror = (e) => {
      webAudioPlayer = null;
      onError?.(e);
    };
    await audio.play();
    return { durationMs: (audio.duration || 0) * 1000 };
  }

  if (!HaikuVoice) {
    throw new Error('Native voice module is not available.');
  }

  const completeSub = voiceEmitter?.addListener('onVoicePlaybackComplete', () => {
    completeSub?.remove();
    errorSub?.remove();
    onComplete?.();
  });
  const errorSub = voiceEmitter?.addListener('onVoicePlaybackError', (err) => {
    completeSub?.remove();
    errorSub?.remove();
    onError?.(err);
  });

  const res = await HaikuVoice.startPlayback(urlOrUri);
  return { durationMs: Number(res.durationMs) || 0 };
}

export async function pauseVoiceAudio(): Promise<void> {
  if (Platform.OS === 'web') {
    if (webAudioPlayer && !webAudioPlayer.paused) {
      webAudioPlayer.pause();
    }
    return;
  }
  if (HaikuVoice) {
    try {
      await HaikuVoice.pausePlayback();
    } catch {}
  }
}

export async function resumeVoiceAudio(): Promise<void> {
  if (Platform.OS === 'web') {
    if (webAudioPlayer && webAudioPlayer.paused) {
      await webAudioPlayer.play();
    }
    return;
  }
  if (HaikuVoice) {
    try {
      await HaikuVoice.resumePlayback();
    } catch {}
  }
}

export async function stopVoiceAudio(): Promise<void> {
  if (Platform.OS === 'web') {
    if (webAudioPlayer) {
      webAudioPlayer.pause();
      webAudioPlayer.currentTime = 0;
      webAudioPlayer = null;
    }
    return;
  }
  if (HaikuVoice) {
    try {
      await HaikuVoice.stopPlayback();
    } catch {}
  }
}

export async function getVoicePlaybackStatus(): Promise<PlaybackStatus> {
  if (Platform.OS === 'web') {
    if (!webAudioPlayer) {
      return { isPlaying: false, currentPositionMs: 0, durationMs: 0 };
    }
    return {
      isPlaying: !webAudioPlayer.paused,
      currentPositionMs: (webAudioPlayer.currentTime || 0) * 1000,
      durationMs: (webAudioPlayer.duration || 0) * 1000,
    };
  }

  if (HaikuVoice) {
    try {
      const res = await HaikuVoice.getPlaybackStatus();
      return {
        isPlaying: Boolean(res.isPlaying),
        currentPositionMs: Number(res.currentPositionMs) || 0,
        durationMs: Number(res.durationMs) || 0,
      };
    } catch {
      return { isPlaying: false, currentPositionMs: 0, durationMs: 0 };
    }
  }

  return { isPlaying: false, currentPositionMs: 0, durationMs: 0 };
}
