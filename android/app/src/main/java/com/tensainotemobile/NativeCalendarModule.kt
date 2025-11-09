package com.tensainotemobile

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

class NativeCalendarModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val dateFormatter =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
      timeZone = TimeZone.getDefault()
    }

  override fun getName(): String = "NativeCalendar"

  @ReactMethod
  fun getMonthMatrix(year: Int, month: Int, promise: Promise) {
    try {
      val calendar = Calendar.getInstance()
      calendar.clear()
      calendar.set(Calendar.YEAR, year)
      calendar.set(Calendar.MONTH, month)
      calendar.set(Calendar.DAY_OF_MONTH, 1)

      val startOffset = calendar.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY
      calendar.add(Calendar.DAY_OF_MONTH, -startOffset)

      val result = Arguments.createArray()
      for (i in 0 until 42) {
        val dayMap = Arguments.createMap()
        val dateKey = dateFormatter.format(calendar.time)
        dayMap.putString("key", dateKey)
        dayMap.putString("dateKey", dateKey)
        dayMap.putInt("day", calendar.get(Calendar.DAY_OF_MONTH))
        dayMap.putBoolean("isCurrentMonth", calendar.get(Calendar.MONTH) == month)
        dayMap.putDouble("timestamp", calendar.timeInMillis.toDouble())
        result.pushMap(dayMap)
        calendar.add(Calendar.DAY_OF_MONTH, 1)
      }

      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("CALENDAR_ERROR", "Unable to build calendar grid", error)
    }
  }
}
