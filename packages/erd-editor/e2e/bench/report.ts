import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Where every bench writes. The directory is gitignored, so a number that has
 * to outlive the checkout is copied into bench/baselines/ by hand.
 */
export const BENCH_DIR = join(import.meta.dirname, '..', '.bench');

/** The workspace root, four levels above this file's packages/x/e2e/bench. */
export const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');

/**
 * Rewrites an absolute path as one under the repository, so a report copied
 * into bench/baselines/ and committed carries no developer's home directory.
 */
export function repoRelative(path: string) {
  return relative(REPO_ROOT, path).split(sep).join('/');
}

export type BenchCorpus = {
  name: string;
  tables: number;
  relationships: number;
  columns: number;
};

export type BenchReport<Row> = {
  label: string;
  createdAt: string;
  /** Absent on reports written before versioning — treated as version 1. */
  metricsVersion?: number;
  /** The corpus measured, for the benches that run exactly one. */
  corpus?: BenchCorpus;
  rows: Row[];
};

/**
 * One pair of files per bench, so a run with E2E_BENCH_ALL=1 does not leave the
 * diagnostics overwriting each other. routing.bench.ts predates this module and
 * keeps the unprefixed pair its saved baselines were written under.
 */
export function benchPaths(name: string) {
  return {
    latest: join(BENCH_DIR, `${name}.latest.json`),
    baseline: join(BENCH_DIR, `${name}.baseline.json`),
  };
}

/** The envelope every bench writes: which run this was, and what it measured. */
export function createReport<Row>(
  rows: Row[],
  metricsVersion: number,
  corpus?: BenchCorpus
): BenchReport<Row> {
  return {
    label: process.env.E2E_BENCH_LABEL ?? 'unlabelled',
    createdAt: new Date().toISOString(),
    metricsVersion,
    corpus,
    rows,
  };
}

/**
 * Writes latest every run and baseline only on request, so a comparison is
 * always against a baseline someone chose.
 */
export function writeReport<Row>(name: string, report: BenchReport<Row>) {
  const { latest, baseline } = benchPaths(name);
  const json = `${JSON.stringify(report, null, 2)}\n`;

  mkdirSync(BENCH_DIR, { recursive: true });
  writeFileSync(latest, json);

  const saved = !!process.env.E2E_BENCH_BASELINE;
  if (saved) writeFileSync(baseline, json);
  return { latest, baseline: saved ? baseline : null };
}

export type BaselineRead<Row> = {
  /** The file as read, kept even when it is not comparable. */
  saved: BenchReport<Row> | null;
  /** The same report, or null when deltas have to be suppressed. */
  baseline: BenchReport<Row> | null;
  /** Why they are suppressed; empty when they are not. */
  note: string;
};

/**
 * A baseline is kept on disk but not compared against once its metrics version
 * or its corpus differs: a percentage between two different quantities is worse
 * than no percentage, because it reads exactly like a result.
 */
export function readBaseline<Row>(
  name: string,
  metricsVersion: number,
  corpus?: BenchCorpus
): BaselineRead<Row> {
  let saved: BenchReport<Row> | null = null;

  try {
    saved = JSON.parse(
      readFileSync(benchPaths(name).baseline, 'utf8')
    ) as BenchReport<Row>;
  } catch {
    return { saved: null, baseline: null, note: '' };
  }

  const savedVersion = saved.metricsVersion ?? 1;
  if (savedVersion !== metricsVersion) {
    return {
      saved,
      baseline: null,
      note: `baseline "${saved.label}" is metrics v${savedVersion}, this run is v${metricsVersion} — no deltas; re-record with E2E_BENCH_BASELINE=1`,
    };
  }

  if (corpus && saved.corpus && saved.corpus.name !== corpus.name) {
    return {
      saved,
      baseline: null,
      note: `baseline "${saved.label}" ran the ${saved.corpus.name} corpus, this run is ${corpus.name} — no deltas`,
    };
  }

  return { saved, baseline: saved, note: '' };
}

/** Percentage change against a saved number; blank when there is none to compare. */
export function delta(
  current: number,
  previous: number | undefined,
  lowerIsBetter = true
) {
  if (previous === undefined || previous === 0) return '';
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 1) return '  ·';
  const better = lowerIsBetter ? change < 0 : change > 0;
  const sign = change > 0 ? '+' : '';
  return `${better ? '▼' : '▲'} ${sign}${change.toFixed(0)}%`;
}
