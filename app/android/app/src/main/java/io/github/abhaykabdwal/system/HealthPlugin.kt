package io.github.abhaykabdwal.system

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.Duration
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Read-only bridge to Health Connect: today's steps and exercise sessions (with
 * distance), so runs, walks and rides logged by a watch or phone can fill quest tasks.
 * Nothing is written to Health Connect.
 */
@CapacitorPlugin(name = "Health")
class HealthPlugin : Plugin() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
    )

    private fun client() = HealthConnectClient.getOrCreate(context)

    @PluginMethod
    fun availability(call: PluginCall) {
        val status = when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
            else -> "unavailable"
        }
        call.resolve(JSObject().put("status", status))
    }

    @PluginMethod
    fun requestAccess(call: PluginCall) {
        scope.launch {
            try {
                if (client().permissionController.getGrantedPermissions().containsAll(permissions)) {
                    call.resolve(JSObject().put("granted", true))
                    return@launch
                }
                val intent = PermissionController.createRequestPermissionResultContract().createIntent(context, permissions)
                startActivityForResult(call, intent, "accessResult")
            } catch (e: Exception) {
                call.reject(e.message ?: "Health Connect is not available")
            }
        }
    }

    @ActivityCallback
    private fun accessResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        scope.launch {
            try {
                val granted = client().permissionController.getGrantedPermissions().containsAll(permissions)
                call.resolve(JSObject().put("granted", granted))
            } catch (e: Exception) {
                call.reject(e.message ?: "Health Connect is not available")
            }
        }
    }

    /** `date`: local YYYY-MM-DD. Returns steps and sessions with kind, minutes and metres. */
    @PluginMethod
    fun readDay(call: PluginCall) {
        val date = call.getString("date") ?: return call.reject("date is required")
        scope.launch {
            try {
                val zone = ZoneId.systemDefault()
                val start = LocalDate.parse(date).atStartOfDay(zone).toInstant()
                val end = LocalDate.parse(date).plusDays(1).atStartOfDay(zone).toInstant()
                val hc = client()
                val steps = hc.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(start, end)))[StepsRecord.COUNT_TOTAL] ?: 0L
                val sessions = hc.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, TimeRangeFilter.between(start, end))).records
                val out = JSArray()
                for (s in sessions) {
                    val metres = hc.aggregate(AggregateRequest(setOf(DistanceRecord.DISTANCE_TOTAL), TimeRangeFilter.between(s.startTime, s.endTime)))[DistanceRecord.DISTANCE_TOTAL]?.inMeters ?: 0.0
                    out.put(
                        JSObject()
                            .put("kind", kindOf(s.exerciseType))
                            .put("minutes", Duration.between(s.startTime, s.endTime).toMinutes())
                            .put("metres", metres)
                            .put("title", s.title ?: ""),
                    )
                }
                call.resolve(JSObject().put("steps", steps).put("sessions", out))
            } catch (e: SecurityException) {
                call.reject("Health Connect access was not granted")
            } catch (e: Exception) {
                call.reject(e.message ?: "Could not read Health Connect")
            }
        }
    }

    private fun kindOf(type: Int): String = when (type) {
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING, ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "running"
        ExerciseSessionRecord.EXERCISE_TYPE_WALKING, ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "walking"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING, ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "biking"
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING, ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING, ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS -> "strength"
        ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING, ExerciseSessionRecord.EXERCISE_TYPE_BOOT_CAMP -> "hiit"
        else -> "other"
    }
}
