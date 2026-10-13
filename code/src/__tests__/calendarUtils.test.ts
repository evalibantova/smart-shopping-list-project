import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getWeekStart,
  toDateStr,
  getDayDates,
  formatWeekRange,
  isToday,
} from '../features/meal-planner/utils/calendarUtils'
import { getWeekStart as getWeekStartFromUtils } from '../utils/calendar'

describe('calendarUtils', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('(a) getWeekStart of a Monday returns same date', () => {
    const monday = new Date(2026, 8, 28) // Sep 28, 2026 — a Monday
    const result = getWeekStart(monday)
    expect(toDateStr(result)).toBe('2026-09-28')
  })

  it('(b) getWeekStart of a Wednesday returns preceding Monday', () => {
    const wed = new Date(2026, 9, 7) // Oct 7, 2026 — a Wednesday
    const result = getWeekStart(wed)
    expect(toDateStr(result)).toBe('2026-10-05')
  })

  it('(c) getWeekStart of a Sunday returns preceding Monday', () => {
    const sun = new Date(2026, 9, 4) // Oct 4, 2026 — a Sunday
    const result = getWeekStart(sun)
    expect(toDateStr(result)).toBe('2026-09-28')
  })

  it('(d) formatWeekRange returns correct D – D Mon YYYY format', () => {
    const monday = new Date(2026, 8, 21) // Mon Sep 21 — Sunday = Sep 27
    const result = formatWeekRange(monday)
    expect(result).toBe('21 – 27 Sep 2026')
  })

  it('formatWeekRange includes both years when week crosses a year boundary', () => {
    const monday = new Date(2026, 11, 28) // Mon Dec 28 — Sunday = Jan 3
    expect(formatWeekRange(monday)).toBe('28 Dec 2026 – 3 Jan 2027')
  })

  it('(e) getDayDates returns 7 dates starting from Monday', () => {
    const monday = new Date(2026, 8, 28) // Sep 28
    const dates = getDayDates(monday)
    expect(dates).toHaveLength(7)
    expect(toDateStr(dates[0])).toBe('2026-09-28') // Mon
    expect(toDateStr(dates[6])).toBe('2026-10-04') // Sun
  })

  it('(f) toDateStr formats as YYYY-MM-DD', () => {
    const date = new Date(2026, 8, 28) // Sep 28
    expect(toDateStr(date)).toBe('2026-09-28')
  })

  it('(g) formatWeekRange includes start month when week crosses month boundary', () => {
    const monday = new Date(2026, 8, 28) // Sep 28 — Sunday = Oct 4
    const result = formatWeekRange(monday)
    expect(result).toBe('28 Sep – 4 Oct 2026')
  })

  it('(h) isToday returns true for today and false for another date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 28)) // pin to Sep 28 2026
    expect(isToday(new Date(2026, 8, 28))).toBe(true)
    expect(isToday(new Date(2026, 8, 27))).toBe(false)
  })
})

describe('utils/calendar — getWeekStart', () => {
  it('(a) Monday input returns same date', () => {
    const monday = new Date(2026, 8, 28)
    expect(toDateStr(getWeekStartFromUtils(monday))).toBe('2026-09-28')
  })

  it('(b) Wednesday input returns preceding Monday', () => {
    const wed = new Date(2026, 9, 7)
    expect(toDateStr(getWeekStartFromUtils(wed))).toBe('2026-10-05')
  })

  it('(c) Sunday input returns preceding Monday', () => {
    const sun = new Date(2026, 9, 4)
    expect(toDateStr(getWeekStartFromUtils(sun))).toBe('2026-09-28')
  })
})
