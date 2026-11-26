# Parent published timetable

The Parent academic panel truncated schedules to twelve entries, hiding later weekdays. It now passes every published session to the same TimetableStudio used by Teacher and Student, at full content width.

Parent view keeps Monday-Friday accessible, shows actual teaching-day/session totals, and explains unpublished empty days. Optional published weekend sessions are retained. Child changes remount the timetable, clearing filters and day selection. Loading does not present a temporary empty timetable as a missing publication.

Validation: TypeScript/Vite production build and twelve staged browser variants (390/768/1440 px, light/dark, FR/EN), using synthetic parent/child API fixtures. A 35-session week retains all sessions and Friday; search, chronological order, day/week views and child switching pass. A one-day timetable retains five weekday selectors with accurate session/day counts. No API, academic-data or access-policy changes. Deploy nexus_web only.
