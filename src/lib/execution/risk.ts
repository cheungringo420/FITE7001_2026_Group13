import { ExecutionLeg, ExecutionQuote } from './types';

export interface RiskResult {
  status: 'ok' | 'blocked';
  reasons: string[];
  estimatedNotional: number;
}

export function evaluateRisk(legs: ExecutionLeg[], maxNotional: number): RiskResult {
  const reasons: string[] = [];
  const estimatedNotional = legs.reduce((sum, leg) => sum + leg.size * leg.limitPrice, 0);

  if (!legs.length) {
    reasons.push('No execution legs provided');
  }

  if (estimatedNotional > maxNotional) {
    reasons.push(`Max notional exceeded (${estimatedNotional.toFixed(2)} > ${maxNotional.toFixed(2)})`);
  }

  if (legs.some((leg) => leg.size <= 0 || leg.limitPrice <= 0)) {
    reasons.push('Invalid size or limit price');
  }

  return {
    status: reasons.length ? 'blocked' : 'ok',
    reasons,
    estimatedNotional,
  };
}

export function applyRiskToQuote(quote: ExecutionQuote, maxNotional: number): ExecutionQuote {
  const risk = evaluateRisk(quote.legs, maxNotional);
  return {
    ...quote,
    validation: {
      ...quote.validation,
      riskStatus: risk.status,
      reasons: risk.reasons.length ? [...(quote.validation.reasons || []), ...risk.reasons] : quote.validation.reasons,
    },
  };
}
