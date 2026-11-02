/**
 * Cron Pattern Helpers
 *
 * Provides user-friendly helpers for creating cron expressions without memorizing cron syntax.
 *
 * ## Pattern Format
 *
 * Cron patterns use 5 or 6 fields:
 * ```
 * ┌────────────── second (0-59) [optional]
 * │ ┌──────────── minute (0-59)
 * │ │ ┌────────── hour (0-23)
 * │ │ │ ┌──────── day of month (1-31)
 * │ │ │ │ ┌────── month (1-12)
 * │ │ │ │ │ ┌──── day of week (0-6, Sunday = 0)
 * │ │ │ │ │ │
 * * * * * * *
 * ```
 *
 * ## Usage
 *
 * You can use these patterns in two ways:
 *
 * ### 1. Direct API (Recommended)
 * ```typescript
 * q.schedule.daily('09:00').job(myJob).data({})
 * q.schedule.weekdays('14:30').job(myJob).data({})
 * q.schedule.everyMinutes(5).job(myJob).data({})
 * ```
 *
 * ### 2. Pattern Helpers
 * ```typescript
 * import { CronPatterns } from '@arki/queue';
 *
 * q.schedule.cron(CronPatterns.daily('09:00')).job(myJob).data({})
 * q.schedule.cron(CronPatterns.midnight).job(myJob).data({})
 * ```
 *
 * @module cron-patterns
 */
import { QUEUE_DEFINITION_ERROR_CODES, QueueDefinitionError } from './errors.js';
/**
 * Build the coded error for an out-of-range cron helper argument
 */
function invalidCronValue(message) {
    return new QueueDefinitionError({
        code: QUEUE_DEFINITION_ERROR_CODES.invalidCronValue,
        message,
        remediation: 'Pass a value inside the range named in the message (time strings use 24-hour HH:mm).',
    });
}
/**
 * Day of week mapping
 */
const DAY_OF_WEEK = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
};
/**
 * Parse time string (HH:mm or HH) into hours and minutes
 */
function parseTime(time) {
    const parts = time.split(':');
    if (parts.length > 2) {
        throw invalidCronValue(`Invalid time: ${time}. Use HH:mm or HH`);
    }
    const [hours = '', minutes = '0'] = parts;
    // Validate hours and minutes. Digits only: parseInt would accept "9am" and
    // pass the text through into the cron expression.
    const h = /^\d{1,2}$/.test(hours) ? Number(hours) : Number.NaN;
    const m = /^\d{1,2}$/.test(minutes) ? Number(minutes) : Number.NaN;
    if (Number.isNaN(h) || h < 0 || h > 23) {
        throw invalidCronValue(`Invalid hours: ${hours}. Must be 0-23`);
    }
    if (Number.isNaN(m) || m < 0 || m > 59) {
        throw invalidCronValue(`Invalid minutes: ${minutes}. Must be 0-59`);
    }
    // Normalized numbers ("09" -> "9"): the cron field is the value, not the text.
    return { hours: String(h), minutes: String(m) };
}
/**
 * Time-based helpers
 */
export const CronPatterns = {
    /**
     * Every N seconds (requires 6-field cron support)
     * @example CronPatterns.everySeconds(5) // "* /5 * * * * *" - Every 5 seconds
     * @example CronPatterns.everySeconds(30) // "* /30 * * * * *" - Every 30 seconds
     */
    everySeconds: (n) => {
        if (!Number.isInteger(n) || n <= 0 || n > 59) {
            throw invalidCronValue('Seconds must be between 1 and 59');
        }
        return `*/${n} * * * * *`;
    },
    /**
     * Every N minutes
     * @example CronPatterns.everyMinutes(5) // "* /5 * * * *" - Every 5 minutes
     * @example CronPatterns.everyMinutes(15) // "* /15 * * * *" - Every 15 minutes
     */
    everyMinutes: (n) => {
        if (!Number.isInteger(n) || n <= 0 || n > 59) {
            throw invalidCronValue('Minutes must be between 1 and 59');
        }
        return `*/${n} * * * *`;
    },
    /**
     * Every N hours
     * @example CronPatterns.everyHours(2) // "0 0-23/2 * * *" - Every 2 hours
     * @example CronPatterns.everyHours(6) // "0 0-23/6 * * *" - Every 6 hours
     */
    everyHours: (n) => {
        if (!Number.isInteger(n) || n <= 0 || n > 23) {
            throw invalidCronValue('Hours must be between 1 and 23');
        }
        return `0 0-23/${n} * * *`;
    },
    /**
     * Every N days at specified time
     * @example CronPatterns.everyDays(2, '09:00') // "0 9 * /2 * *" - Every 2 days at 9am
     */
    everyDays: (n, time) => {
        if (!Number.isInteger(n) || n <= 0 || n > 31) {
            throw invalidCronValue('Days must be between 1 and 31');
        }
        const { hours, minutes } = parseTime(time);
        return `${minutes} ${hours} */${n} * *`;
    },
    /**
     * Daily at specified time
     * @example CronPatterns.daily('09:00') // "0 9 * * *" - Every day at 9am
     * @example CronPatterns.daily('14:30') // "30 14 * * *" - Every day at 2:30pm
     * @example CronPatterns.daily('23') // "0 23 * * *" - Every day at 11pm
     */
    daily: (time) => {
        const { hours, minutes } = parseTime(time);
        return `${minutes} ${hours} * * *`;
    },
    /**
     * Weekdays (Monday-Friday) at specified time
     * @example CronPatterns.weekdays('09:00') // "0 9 * * 1-5" - Weekdays at 9am
     * @example CronPatterns.weekdays('17:30') // "30 17 * * 1-5" - Weekdays at 5:30pm
     */
    weekdays: (time) => {
        const { hours, minutes } = parseTime(time);
        return `${minutes} ${hours} * * 1-5`;
    },
    /**
     * Weekends (Saturday-Sunday) at specified time
     * @example CronPatterns.weekends('10:00') // "0 10 * * 0,6" - Weekends at 10am
     * @example CronPatterns.weekends('14:00') // "0 14 * * 0,6" - Weekends at 2pm
     */
    weekends: (time) => {
        const { hours, minutes } = parseTime(time);
        return `${minutes} ${hours} * * 0,6`;
    },
    /**
     * Weekly on specific day at specified time
     * @example CronPatterns.weekly('monday', '09:00') // "0 9 * * 1" - Mondays at 9am
     * @example CronPatterns.weekly('friday', '17:00') // "0 17 * * 5" - Fridays at 5pm
     */
    weekly: (day, time) => {
        const { hours, minutes } = parseTime(time);
        const dayNum = DAY_OF_WEEK[day];
        return `${minutes} ${hours} * * ${dayNum}`;
    },
    /**
     * Monthly on specific day at specified time
     * @example CronPatterns.monthly(1, '09:00') // "0 9 1 * *" - First day of month at 9am
     * @example CronPatterns.monthly(15, '12:00') // "0 12 15 * *" - 15th of month at noon
     */
    monthly: (day, time) => {
        if (!Number.isInteger(day) || day < 1 || day > 31) {
            throw invalidCronValue('Day of month must be between 1 and 31');
        }
        const { hours, minutes } = parseTime(time);
        return `${minutes} ${hours} ${day} * *`;
    },
    /**
     * First day of month at specified time
     * @example CronPatterns.monthlyStart('09:00') // "0 9 1 * *" - First day of month at 9am
     */
    monthlyStart: (time) => {
        const { hours, minutes } = parseTime(time);
        return `${minutes} ${hours} 1 * *`;
    },
    /**
     * Last day of month at specified time (approximation using 28th)
     * Note: This uses 28th as it's safe for all months
     * @example CronPatterns.monthlyEnd('23:59') // "59 23 28 * *" - 28th of month at 11:59pm
     */
    monthlyEnd: (time) => {
        const { hours, minutes } = parseTime(time);
        return `${minutes} ${hours} 28 * *`;
    },
    /**
     * Quarterly on first day at specified time
     * @example CronPatterns.quarterly('09:00') // "0 9 1 * /3 *" - Quarterly at 9am
     */
    quarterly: (time) => {
        const { hours, minutes } = parseTime(time);
        return `${minutes} ${hours} 1 */3 *`;
    },
    /**
     * Yearly on January 1st at specified time
     * @example CronPatterns.yearly('00:00') // "0 0 1 1 *" - January 1st at midnight
     */
    yearly: (time) => {
        const { hours, minutes } = parseTime(time);
        return `${minutes} ${hours} 1 1 *`;
    },
    // ============================================
    // Common Presets
    // ============================================
    /**
     * Every second (requires 6-field cron support)
     */
    everySecond: '* * * * * *',
    /**
     * Every 5 seconds (requires 6-field cron support)
     */
    everyFiveSeconds: '*/5 * * * * *',
    /**
     * Every 10 seconds (requires 6-field cron support)
     */
    everyTenSeconds: '*/10 * * * * *',
    /**
     * Every 30 seconds (requires 6-field cron support)
     */
    everyThirtySeconds: '*/30 * * * * *',
    /**
     * Every minute (at the start of the minute)
     */
    everyMinute: '*/1 * * * *',
    /**
     * Every 5 minutes
     */
    everyFiveMinutes: '*/5 * * * *',
    /**
     * Every 10 minutes
     */
    everyTenMinutes: '*/10 * * * *',
    /**
     * Every 15 minutes
     */
    everyFifteenMinutes: '*/15 * * * *',
    /**
     * Every 30 minutes
     */
    everyThirtyMinutes: '*/30 * * * *',
    /**
     * Every hour (at the start of the hour)
     */
    hourly: '0 * * * *',
    /**
     * Every 2 hours
     */
    everyTwoHours: '0 */2 * * *',
    /**
     * Every 3 hours
     */
    everyThreeHours: '0 */3 * * *',
    /**
     * Every 4 hours
     */
    everyFourHours: '0 */4 * * *',
    /**
     * Every 6 hours
     */
    everySixHours: '0 */6 * * *',
    /**
     * Every 12 hours
     */
    everyTwelveHours: '0 */12 * * *',
    /**
     * Every day at midnight (00:00)
     */
    midnight: '0 0 * * *',
    /**
     * Every day at noon (12:00)
     */
    noon: '0 12 * * *',
    /**
     * Every day at 6am
     */
    morningAt6: '0 6 * * *',
    /**
     * Every day at 9am
     */
    morningAt9: '0 9 * * *',
    /**
     * Every day at 6pm
     */
    eveningAt6: '0 18 * * *',
    /**
     * Every Monday at 9am
     */
    mondayMorning: '0 9 * * 1',
    /**
     * Every Friday at 5pm
     */
    fridayEvening: '0 17 * * 5',
    /**
     * First day of every month at midnight
     */
    monthlyAtMidnight: '0 0 1 * *',
    /**
     * First day of every month at 9am
     */
    monthlyAtNine: '0 9 1 * *',
};
//# sourceMappingURL=cron-patterns.js.map