#import "VoiceModule.h"

@implementation VoiceModule {
  AVAudioRecorder *_audioRecorder;
  AVAudioPlayer *_audioPlayer;
  NSURL *_currentOutputUrl;
  NSTimeInterval _recordingStartTime;
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE(HaikuVoice);

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onVoicePlaybackComplete", @"onVoicePlaybackError"];
}

- (void)startObserving {
  _hasListeners = YES;
}

- (void)stopObserving {
  _hasListeners = NO;
}

RCT_EXPORT_METHOD(startRecording:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  AVAudioSession *session = [AVAudioSession sharedInstance];
  NSError *error = nil;
  
  [session setCategory:AVAudioSessionCategoryPlayAndRecord
           withOptions:AVAudioSessionCategoryOptionDefaultToSpeaker
                 error:&error];
  if (error) {
    reject(@"SESSION_ERROR", error.localizedDescription, error);
    return;
  }
  
  [session setActive:YES error:&error];
  if (error) {
    reject(@"SESSION_ACTIVE_ERROR", error.localizedDescription, error);
    return;
  }
  
  NSString *fileName = [NSString stringWithFormat:@"voice_%.0f.m4a", [[NSDate date] timeIntervalSince1970] * 1000];
  NSString *cacheDir = [NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES) firstObject];
  NSString *filePath = [cacheDir stringByAppendingPathComponent:fileName];
  _currentOutputUrl = [NSURL fileURLWithPath:filePath];
  
  NSDictionary *settings = @{
    AVFormatIDKey: @(kAudioFormatMPEG4AAC),
    AVSampleRateKey: @(44100.0),
    AVNumberOfChannelsKey: @(1),
    AVEncoderAudioQualityKey: @(AVAudioQualityHigh),
    AVEncoderBitRateKey: @(128000)
  };
  
  _audioRecorder = [[AVAudioRecorder alloc] initWithURL:_currentOutputUrl settings:settings error:&error];
  if (error || !_audioRecorder) {
    reject(@"RECORDER_INIT_ERROR", error ? error.localizedDescription : @"Could not init recorder", error);
    return;
  }
  
  _audioRecorder.delegate = self;
  if (![_audioRecorder record]) {
    reject(@"RECORD_START_ERROR", @"Failed to start recording", nil);
    return;
  }
  
  _recordingStartTime = [NSDate timeIntervalSinceReferenceDate];
  resolve(@{
    @"filePath": filePath,
    @"uri": _currentOutputUrl.absoluteString
  });
}

RCT_EXPORT_METHOD(stopRecording:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  if (!_audioRecorder) {
    reject(@"NOT_RECORDING", @"Recorder is not active", nil);
    return;
  }
  
  [_audioRecorder stop];
  _audioRecorder = nil;
  
  if (_currentOutputUrl) {
    NSError *attrError = nil;
    NSDictionary *attrs = [[NSFileManager defaultManager] attributesOfItemAtPath:_currentOutputUrl.path error:&attrError];
    unsigned long long fileSize = [attrs fileSize];
    NSTimeInterval durationSec = [NSDate timeIntervalSinceReferenceDate] - _recordingStartTime;
    
    if (fileSize > 0) {
      resolve(@{
        @"uri": _currentOutputUrl.absoluteString,
        @"filePath": _currentOutputUrl.path,
        @"durationMs": @(durationSec * 1000.0),
        @"durationSec": @(durationSec),
        @"byteSize": @(fileSize),
        @"mimeType": @"audio/mp4"
      });
      return;
    }
  }
  reject(@"RECORD_EMPTY", @"No audio recorded", nil);
}

RCT_EXPORT_METHOD(cancelRecording:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  if (_audioRecorder) {
    [_audioRecorder stop];
    _audioRecorder = nil;
  }
  if (_currentOutputUrl) {
    [[NSFileManager defaultManager] removeItemAtURL:_currentOutputUrl error:nil];
    _currentOutputUrl = nil;
  }
  resolve(@(YES));
}

RCT_EXPORT_METHOD(startPlayback:(NSString *)sourceUri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  if (_audioPlayer) {
    [_audioPlayer stop];
    _audioPlayer = nil;
  }
  
  NSURL *url = [NSURL URLWithString:sourceUri];
  if (!url || !url.scheme) {
    url = [NSURL fileURLWithPath:sourceUri];
  }
  
  NSError *error = nil;
  NSData *data = [NSData dataWithContentsOfURL:url options:0 error:&error];
  if (error || !data) {
    reject(@"LOAD_ERROR", error ? error.localizedDescription : @"Failed to load audio data", error);
    return;
  }
  
  _audioPlayer = [[AVAudioPlayer alloc] initWithData:data error:&error];
  if (error || !_audioPlayer) {
    reject(@"PLAYER_INIT_ERROR", error ? error.localizedDescription : @"Failed to init player", error);
    return;
  }
  
  _audioPlayer.delegate = self;
  if (![_audioPlayer play]) {
    reject(@"PLAY_FAILED", @"Could not begin audio playback", nil);
    return;
  }
  
  resolve(@{
    @"durationMs": @(_audioPlayer.duration * 1000.0),
    @"durationSec": @(_audioPlayer.duration)
  });
}

RCT_EXPORT_METHOD(pausePlayback:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  if (_audioPlayer && _audioPlayer.isPlaying) {
    [_audioPlayer pause];
  }
  resolve(@(YES));
}

RCT_EXPORT_METHOD(resumePlayback:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  if (_audioPlayer && !_audioPlayer.isPlaying) {
    [_audioPlayer play];
  }
  resolve(@(YES));
}

RCT_EXPORT_METHOD(stopPlayback:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  if (_audioPlayer) {
    [_audioPlayer stop];
    _audioPlayer = nil;
  }
  resolve(@(YES));
}

RCT_EXPORT_METHOD(getPlaybackStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  BOOL playing = _audioPlayer ? _audioPlayer.isPlaying : NO;
  NSTimeInterval current = _audioPlayer ? _audioPlayer.currentTime : 0;
  NSTimeInterval duration = _audioPlayer ? _audioPlayer.duration : 0;
  
  resolve(@{
    @"isPlaying": @(playing),
    @"currentPositionMs": @(current * 1000.0),
    @"durationMs": @(duration * 1000.0)
  });
}

#pragma mark - AVAudioPlayerDelegate

- (void)audioPlayerDidFinishPlaying:(AVAudioPlayer *)player successfully:(BOOL)flag {
  if (_hasListeners) {
    [self sendEventWithName:@"onVoicePlaybackComplete" body:@{@"success": @(flag)}];
  }
}

- (void)audioPlayerDecodeErrorDidOccur:(AVAudioPlayer *)player error:(NSError *)error {
  if (_hasListeners) {
    [self sendEventWithName:@"onVoicePlaybackError" body:@{@"error": error.localizedDescription ?: @"Decode error"}];
  }
}

@end
