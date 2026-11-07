package com.haikumessenger.immersive

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.haikumessenger.MainActivity

class ImmersiveModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "HaikuImmersive"

  @ReactMethod
  fun setImmersive(enabled: Boolean, promise: Promise) {
    MainActivity.isImmersiveEnabled = enabled
    val activity = currentActivity as? MainActivity
    if (activity != null) {
      activity.runOnUiThread {
        MainActivity.applyImmersiveMode(activity)
        promise.resolve(true)
      }
    } else {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun isImmersive(promise: Promise) {
    promise.resolve(MainActivity.isImmersiveEnabled)
  }
}
