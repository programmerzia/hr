import type {
  AttendanceDay,
  AttendancePolicy,
  Holiday,
  RegularizationRequest,
  TaskTimeEntry,
  TimeSegment,
} from '../../types'

export const attendancePolicy: AttendancePolicy = {
  shift_start: '09:00',
  shift_end: '18:00',
  grace_minutes: 10,
  standard_minutes: 480,
  idle_timeout_minutes: 10,
  lunch_cap_minutes: 60,
  late_penalty_rule: { lates_per_penalty: 3, penalty_days: 0.5 },
  weekend_days: [5, 6],
}

export const holidays: Holiday[] = []
export const attendanceDays: AttendanceDay[] = []
export const timeSegments: TimeSegment[] = []
export const taskTimeEntries: TaskTimeEntry[] = []
export const regularizationRequests: RegularizationRequest[] = []
