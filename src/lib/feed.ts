import type { Buyer } from "./session";

export type Notice = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: number;
  audienceType: string;
};

export type FeedFilter = "all" | "tower" | "unit";
export const PAGE = 15;

export function keysFor(filter: FeedFilter, b: Buyer): string[] {
  const tower = `tower:${b.tower}`;
  const unit = `unit:${b.tower}-${b.unit}`;
  if (filter === "tower") return [tower];
  if (filter === "unit") return [unit];
  return ["all", tower, unit];
}
