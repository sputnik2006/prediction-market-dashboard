import type { Category } from "./types";

/**
 * Curated cross-exchange pairs — hand-verified equivalences between a Kalshi
 * market (by ticker) and a Polymarket market. Each carries BOTH a live
 * Polymarket conditionId (used when Polymarket is reachable) and a snapshot id
 * (used in demo mode), so verified pairs populate in either mode.
 *
 * Kalshi tickers and Polymarket conditionIds below are real and live. Only
 * genuinely-equivalent markets (same outcome, same resolution window) are listed
 * as verified; e.g. Greenland is snapshot-only because the live Polymarket
 * Greenland markets resolve on different dates than Kalshi's.
 */
export interface SeedPair {
  pairKey: string;
  title: string;
  category: Category;
  kalshiTicker: string;
  polyConditionId?: string; // live Polymarket conditionId
  polySnapshotId?: string; // demo snapshot id (lib/snapshot.ts)
}

export const SEED_PAIRS: SeedPair[] = [
  {
    pairKey: "pres-2028-newsom",
    title: "2028 President — Gavin Newsom",
    category: "Politics",
    kalshiTicker: "KXPRESPERSON-28-GNEWS",
    polyConditionId: "0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57",
    polySnapshotId: "0xsnap-pres28-newsom",
  },
  {
    pairKey: "pres-2028-vance",
    title: "2028 President — J.D. Vance",
    category: "Politics",
    kalshiTicker: "KXPRESPERSON-28-JVAN",
    polyConditionId: "0x7ad403c3508f8e3912940fd1a913f227591145ca0614074208e0b962d5fcc422",
    polySnapshotId: "0xsnap-pres28-vance",
  },
  {
    pairKey: "pres-2028-rubio",
    title: "2028 President — Marco Rubio",
    category: "Politics",
    kalshiTicker: "KXPRESPERSON-28-MRUB",
    polyConditionId: "0x2053d8515f1b8cbeea4ccdb56e60e89c2617e43a8660d95166b8e71d27865277",
    polySnapshotId: "0xsnap-pres28-rubio",
  },
  {
    pairKey: "pres-2028-aoc",
    title: "2028 President — Alexandria Ocasio-Cortez",
    category: "Politics",
    kalshiTicker: "KXPRESPERSON-28-AOCA",
    polyConditionId: "0xf232b565995e4b3a3e7fa6cef775eeff1cecd20ad7c013cb9fc8dadabfe279a9",
    polySnapshotId: "0xsnap-pres28-aoc",
  },
  // Snapshot-only: live Polymarket Greenland markets resolve on different dates
  // than Kalshi's, so they are not equivalent enough to mark verified when live.
  {
    pairKey: "greenland-buy",
    title: "Trump buys part of Greenland before 2029",
    category: "Politics",
    kalshiTicker: "KXGREENLAND-29",
    polySnapshotId: "0xsnap-greenland-buy",
  },
  {
    pairKey: "greenland-control",
    title: "US takes control of part of Greenland before 2029",
    category: "Politics",
    kalshiTicker: "KXGREENTERRITORY-29",
    polySnapshotId: "0xsnap-greenland-control",
  },
];
