import { GoalProjection } from "../core/types";

const DAYS_IN_MONTH = 30.44;

export class PlanService {
  calcProjection(totalNow: number, monthly: number, months: number): number {
    const safeTotal = Number.isFinite(totalNow) ? totalNow : 0;
    const safeMonthly = Number.isFinite(monthly) && monthly >= 0 ? monthly : 0;
    const safeMonths = Number.isFinite(months) && months >= 0 ? months : 0;

    return safeTotal + safeMonthly * safeMonths;
  }

  calcRequiredToDeadline(totalNow: number, target: number, deadlineISO: string): GoalProjection {
    const safeTotal = Number.isFinite(totalNow) ? totalNow : 0;
    const safeTarget = Number.isFinite(target) && target >= 0 ? target : 0;
    const remaining = Math.max(0, safeTarget - safeTotal);

    const deadlineMs = Date.parse(deadlineISO);
    const nowMs = Date.now();

    if (Number.isNaN(deadlineMs)) {
      return {
        remaining,
        daysLeft: 0,
        requiredPerDay: 0,
        requiredPerWeek: 0,
        requiredPerMonth: 0,
        isDeadlinePassed: true,
      };
    }

    const daysLeftRaw = Math.ceil((deadlineMs - nowMs) / (1000 * 60 * 60 * 24));

    if (daysLeftRaw <= 0) {
      return {
        remaining,
        daysLeft: daysLeftRaw,
        requiredPerDay: 0,
        requiredPerWeek: 0,
        requiredPerMonth: 0,
        isDeadlinePassed: true,
      };
    }

    const requiredPerDay = remaining / daysLeftRaw;

    return {
      remaining,
      daysLeft: daysLeftRaw,
      requiredPerDay,
      requiredPerWeek: requiredPerDay * 7,
      requiredPerMonth: requiredPerDay * DAYS_IN_MONTH,
      isDeadlinePassed: false,
    };
  }
}
