#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <AVFoundation/AVFoundation.h>

@interface VoiceModule : RCTEventEmitter <RCTBridgeModule, AVAudioRecorderDelegate, AVAudioPlayerDelegate>
@end
