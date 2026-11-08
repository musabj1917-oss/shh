package com.haikumessenger.voice

import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

class VoiceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private var mediaRecorder: MediaRecorder? = null
  private var mediaPlayer: MediaPlayer? = null
  private var currentOutputFile: File? = null
  private var recordingStartTime: Long = 0L

  override fun getName(): String = "HaikuVoice"

  @ReactMethod
  fun startRecording(promise: Promise) {
    try {
      cleanupRecorder()
      val file = File(reactContext.cacheDir, "voice_${System.currentTimeMillis()}.m4a")
      currentOutputFile = file
      recordingStartTime = System.currentTimeMillis()

      val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        MediaRecorder(reactContext)
      } else {
        @Suppress("DEPRECATION")
        MediaRecorder()
      }

      recorder.apply {
        setAudioSource(MediaRecorder.AudioSource.MIC)
        setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        setAudioEncodingBitRate(128000)
        setAudioSamplingRate(44100)
        setOutputFile(file.absolutePath)
        prepare()
        start()
      }
      mediaRecorder = recorder
      val map = Arguments.createMap().apply {
        putString("filePath", file.absolutePath)
        putString("uri", "file://${file.absolutePath}")
      }
      promise.resolve(map)
    } catch (e: Exception) {
      cleanupRecorder()
      promise.reject("RECORD_ERROR", e.message ?: "Failed to start audio recording", e)
    }
  }

  @ReactMethod
  fun stopRecording(promise: Promise) {
    val file = currentOutputFile
    try {
      mediaRecorder?.let {
        try { it.stop() } catch (_: Exception) {}
        it.release()
      }
      mediaRecorder = null

      if (file != null && file.exists() && file.length() > 0) {
        val durationMs = (System.currentTimeMillis() - recordingStartTime).coerceAtLeast(0L)
        val map = Arguments.createMap().apply {
          putString("uri", "file://${file.absolutePath}")
          putString("filePath", file.absolutePath)
          putDouble("durationMs", durationMs.toDouble())
          putDouble("durationSec", (durationMs / 1000.0))
          putDouble("byteSize", file.length().toDouble())
          putString("mimeType", "audio/mp4")
        }
        promise.resolve(map)
      } else {
        promise.reject("RECORD_EMPTY", "No audio recorded")
      }
    } catch (e: Exception) {
      cleanupRecorder()
      promise.reject("STOP_ERROR", e.message ?: "Failed to stop recording", e)
    }
  }

  @ReactMethod
  fun cancelRecording(promise: Promise) {
    cleanupRecorder()
    currentOutputFile?.delete()
    currentOutputFile = null
    promise.resolve(true)
  }

  @ReactMethod
  fun startPlayback(sourceUri: String, promise: Promise) {
    try {
      mediaPlayer?.release()
      mediaPlayer = null

      val player = MediaPlayer().apply {
        setDataSource(sourceUri)
        setOnCompletionListener {
          sendEvent("onVoicePlaybackComplete", Arguments.createMap().apply {
            putString("uri", sourceUri)
          })
        }
        setOnErrorListener { _, what, extra ->
          sendEvent("onVoicePlaybackError", Arguments.createMap().apply {
            putInt("what", what)
            putInt("extra", extra)
          })
          true
        }
        prepare()
        start()
      }
      mediaPlayer = player
      val map = Arguments.createMap().apply {
        putDouble("durationMs", player.duration.toDouble())
        putDouble("durationSec", (player.duration / 1000.0))
      }
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("PLAYBACK_ERROR", e.message ?: "Failed to start audio playback", e)
    }
  }

  @ReactMethod
  fun pausePlayback(promise: Promise) {
    try {
      mediaPlayer?.let {
        if (it.isPlaying) {
          it.pause()
        }
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("PAUSE_ERROR", e.message ?: "Failed to pause playback", e)
    }
  }

  @ReactMethod
  fun resumePlayback(promise: Promise) {
    try {
      mediaPlayer?.let {
        if (!it.isPlaying) {
          it.start()
        }
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("RESUME_ERROR", e.message ?: "Failed to resume playback", e)
    }
  }

  @ReactMethod
  fun stopPlayback(promise: Promise) {
    try {
      mediaPlayer?.let {
        if (it.isPlaying) it.stop()
        it.release()
      }
      mediaPlayer = null
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("STOP_PLAYBACK_ERROR", e.message ?: "Failed to stop playback", e)
    }
  }

  @ReactMethod
  fun getPlaybackStatus(promise: Promise) {
    val player = mediaPlayer
    val map = Arguments.createMap().apply {
      putBoolean("isPlaying", player?.isPlaying ?: false)
      putDouble("currentPositionMs", (player?.currentPosition ?: 0).toDouble())
      putDouble("durationMs", (player?.duration ?: 0).toDouble())
    }
    promise.resolve(map)
  }

  private fun cleanupRecorder() {
    try {
      mediaRecorder?.let {
        try { it.stop() } catch (_: Exception) {}
        it.release()
      }
    } catch (_: Exception) {}
    mediaRecorder = null
  }

  private fun sendEvent(eventName: String, params: WritableMap?) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }
}
