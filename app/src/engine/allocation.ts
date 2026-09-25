/**
 * 진료일 풀 규칙(설계안 4-2, 5-5 ②). 지소당 0~5일 정수 조작, 총량 제한.
 * 현재 실제 배분의 격주 평균(2.5·1.5)은 소수 그대로 두되, 조작은 항상 ±1일이다.
 */

export const MAX_PER_FACILITY = 5

export function total(x: readonly number[]): number {
  let s = 0
  for (const v of x) s += v
  return s
}

export function remaining(x: readonly number[], budget: number): number {
  return Math.round((budget - total(x)) * 10) / 10
}

export function canIncrement(x: readonly number[], j: number, budget: number): boolean {
  return remaining(x, budget) >= 1 && x[j] + 1 <= MAX_PER_FACILITY
}

export function canDecrement(x: readonly number[], j: number): boolean {
  return x[j] >= 1
}

export function increment(x: readonly number[], j: number, budget: number): number[] {
  if (!canIncrement(x, j, budget)) return [...x]
  const y = [...x]
  y[j] += 1
  return y
}

export function decrement(x: readonly number[], j: number): number[] {
  if (!canDecrement(x, j)) return [...x]
  const y = [...x]
  y[j] -= 1
  return y
}

/** 총량보다 많이 놓인 진료일(실험실에서 총량을 줄였을 때). 미션에서는 항상 0. */
export function overBudget(x: readonly number[], budget: number): number {
  return Math.max(0, -remaining(x, budget))
}
