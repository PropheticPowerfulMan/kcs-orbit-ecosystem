// Campus GPS is temporarily optional. Re-enable explicitly once the school is ready.
export const teachingGpsRequired = () => process.env.TEACHING_GPS_REQUIRED === 'true'
export const declaredTeachingPresence = (now:Date) => ({
 status:'PENDING',revision:0,method:'DECLARATION_GPS_DISABLED',
 gpsChecked:false,recordedAt:now.toISOString(),
})
