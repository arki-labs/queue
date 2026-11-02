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
/**
 * Day of week mapping
 */
declare const DAY_OF_WEEK: {
    readonly sunday: 0;
    readonly monday: 1;
    readonly tuesday: 2;
    readonly wednesday: 3;
    readonly thursday: 4;
    readonly friday: 5;
    readonly saturday: 6;
};
export type DayOfWeek = keyof typeof DAY_OF_WEEK;
/**
 * Time-based helpers
 */
export declare const CronPatterns: {
    /**
     * Every N seconds (requires 6-field cron support)
     * @example CronPatterns.everySeconds(5) // "* /5 * * * * *" - Every 5 seconds
     * @example CronPatterns.everySeconds(30) // "* /30 * * * * *" - Every 30 seconds
     */
    readonly everySeconds: (n: number) => string;
    /**
     * Every N minutes
     * @example CronPatterns.everyMinutes(5) // "* /5 * * * *" - Every 5 minutes
     * @example CronPatterns.everyMinutes(15) // "* /15 * * * *" - Every 15 minutes
     */
    readonly everyMinutes: (n: number) => string;
    /**
     * Every N hours
     * @example CronPatterns.everyHours(2) // "0 0-23/2 * * *" - Every 2 hours
     * @example CronPatterns.everyHours(6) // "0 0-23/6 * * *" - Every 6 hours
     */
    readonly everyHours: (n: number) => string;
    /**
     * Every N days at specified time
     * @example CronPatterns.everyDays(2, '09:00') // "0 9 * /2 * *" - Every 2 days at 9am
     */
    readonly everyDays: (n: number, time: string) => string;
    /**
     * Daily at specified time
     * @example CronPatterns.daily('09:00') // "0 9 * * *" - Every day at 9am
     * @example CronPatterns.daily('14:30') // "30 14 * * *" - Every day at 2:30pm
     * @example CronPatterns.daily('23') // "0 23 * * *" - Every day at 11pm
     */
    readonly daily: (time: string) => string;
    /**
     * Weekdays (Monday-Friday) at specified time
     * @example CronPatterns.weekdays('09:00') // "0 9 * * 1-5" - Weekdays at 9am
     * @example CronPatterns.weekdays('17:30') // "30 17 * * 1-5" - Weekdays at 5:30pm
     */
    readonly weekdays: (time: string) => string;
    /**
     * Weekends (Saturday-Sunday) at specified time
     * @example CronPatterns.weekends('10:00') // "0 10 * * 0,6" - Weekends at 10am
     * @example CronPatterns.weekends('14:00') // "0 14 * * 0,6" - Weekends at 2pm
     */
    readonly weekends: (time: string) => string;
    /**
     * Weekly on specific day at specified time
     * @example CronPatterns.weekly('monday', '09:00') // "0 9 * * 1" - Mondays at 9am
     * @example CronPatterns.weekly('friday', '17:00') // "0 17 * * 5" - Fridays at 5pm
     */
    readonly weekly: (day: DayOfWeek, time: string) => string;
    /**
     * Monthly on specific day at specified time
     * @example CronPatterns.monthly(1, '09:00') // "0 9 1 * *" - First day of month at 9am
     * @example CronPatterns.monthly(15, '12:00') // "0 12 15 * *" - 15th of month at noon
     */
    readonly monthly: (day: number, time: string) => string;
    /**
     * First day of month at specified time
     * @example CronPatterns.monthlyStart('09:00') // "0 9 1 * *" - First day of month at 9am
     */
    readonly monthlyStart: (time: string) => string;
    /**
     * Last day of month at specified time (approximation using 28th)
     * Note: This uses 28th as it's safe for all months
     * @example CronPatterns.monthlyEnd('23:59') // "59 23 28 * *" - 28th of month at 11:59pm
     */
    readonly monthlyEnd: (time: string) => string;
    /**
     * Quarterly on first day at specified time
     * @example CronPatterns.quarterly('09:00') // "0 9 1 * /3 *" - Quarterly at 9am
     */
    readonly quarterly: (time: string) => string;
    /**
     * Yearly on January 1st at specified time
     * @example CronPatterns.yearly('00:00') // "0 0 1 1 *" - January 1st at midnight
     */
    readonly yearly: (time: string) => string;
    /**
     * Every second (requires 6-field cron support)
     */
    readonly everySecond: '* * * * * *';
    /**
     * Every 5 seconds (requires 6-field cron support)
     */
    readonly everyFiveSeconds: '*/5 * * * * *';
    /**
     * Every 10 seconds (requires 6-field cron support)
     */
    readonly everyTenSeconds: '*/10 * * * * *';
    /**
     * Every 30 seconds (requires 6-field cron support)
     */
    readonly everyThirtySeconds: '*/30 * * * * *';
    /**
     * Every minute (at the start of the minute)
     */
    readonly everyMinute: '*/1 * * * *';
    /**
     * Every 5 minutes
     */
    readonly everyFiveMinutes: '*/5 * * * *';
    /**
     * Every 10 minutes
     */
    readonly everyTenMinutes: '*/10 * * * *';
    /**
     * Every 15 minutes
     */
    readonly everyFifteenMinutes: '*/15 * * * *';
    /**
     * Every 30 minutes
     */
    readonly everyThirtyMinutes: '*/30 * * * *';
    /**
     * Every hour (at the start of the hour)
     */
    readonly hourly: '0 * * * *';
    /**
     * Every 2 hours
     */
    readonly everyTwoHours: '0 */2 * * *';
    /**
     * Every 3 hours
     */
    readonly everyThreeHours: '0 */3 * * *';
    /**
     * Every 4 hours
     */
    readonly everyFourHours: '0 */4 * * *';
    /**
     * Every 6 hours
     */
    readonly everySixHours: '0 */6 * * *';
    /**
     * Every 12 hours
     */
    readonly everyTwelveHours: '0 */12 * * *';
    /**
     * Every day at midnight (00:00)
     */
    readonly midnight: '0 0 * * *';
    /**
     * Every day at noon (12:00)
     */
    readonly noon: '0 12 * * *';
    /**
     * Every day at 6am
     */
    readonly morningAt6: '0 6 * * *';
    /**
     * Every day at 9am
     */
    readonly morningAt9: '0 9 * * *';
    /**
     * Every day at 6pm
     */
    readonly eveningAt6: '0 18 * * *';
    /**
     * Every Monday at 9am
     */
    readonly mondayMorning: '0 9 * * 1';
    /**
     * Every Friday at 5pm
     */
    readonly fridayEvening: '0 17 * * 5';
    /**
     * First day of every month at midnight
     */
    readonly monthlyAtMidnight: '0 0 1 * *';
    /**
     * First day of every month at 9am
     */
    readonly monthlyAtNine: '0 9 1 * *';
};
export {};
//# sourceMappingURL=cron-patterns.d.ts.map