/**
 * Feature flags resolved from environment variables.
 * Server-safe: reads process.env directly, no client bundle leakage.
 */

export type ExecutionMode = 'paper' | 'live';

/** Returns the current execution mode ('paper' | 'live'). Defaults to 'paper'. */
export function getExecutionMode(): ExecutionMode {
  const mode =
    process.env.EXECUTION_MODE ?? process.env.NEXT_PUBLIC_EXECUTION_MODE ?? 'paper';
  return mode === 'live' ? 'live' : 'paper';
}

/** Returns true when experimental labs features are enabled. */
export function isLabsEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_LABS_ENABLED === 'true' ||
    process.env.LABS_ENABLED === 'true'
  );
}

/** Returns a structured feature flags object. */
export function getFeatureFlags() {
  return {
    labs: isLabsEnabled(),
    executionMode: getExecutionMode(),
    synthetic: isSyntheticEnabled(),
  };
}

/** Returns true when synthetic/demo data fallbacks are enabled. */
export function isSyntheticEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_SYNTHETIC_ENABLED === 'true' ||
    process.env.SYNTHETIC_ENABLED === 'true'
  );
}
