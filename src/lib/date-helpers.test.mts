import { test } from "node:test";
import assert from "node:assert/strict";
import { getTodayHari, todayStr, daysUntil } from "./date-helpers.ts";

test("getTodayHari maps Sunday to 7", () => {
  const actualSunday = new Date("2026-06-28T12:00:00"); // Sunday
  const original = Date.prototype.getDay;
  try {
    Date.prototype.getDay = function () {
      if (this.getTime() === actualSunday.getTime()) return 0;
      return original.call(this);
    };
    assert.equal(getTodayHari(), 7);
  } finally {
    Date.prototype.getDay = original;
  }
});

test("getTodayHari maps Monday to 1", () => {
  const actualMonday = new Date("2026-06-29T12:00:00"); // Monday
  const original = Date.prototype.getDay;
  try {
    Date.prototype.getDay = function () {
      if (this.getTime() === actualMonday.getTime()) return 1;
      return original.call(this);
    };
    assert.equal(getTodayHari(), 1);
  } finally {
    Date.prototype.getDay = original;
  }
});

test("todayStr returns YYYY-MM-DD", () => {
  const now = new Date("2026-06-30T15:30:00");
  const original = Date.prototype.toISOString;
  Date.now = () => now.getTime();
  try {
    assert.equal(todayStr(), "2026-06-30");
  } finally {
    Date.now = () => new Date().getTime();
  }
});

test("daysUntil calculates whole days until a future date", () => {
  const now = new Date("2026-06-30T12:00:00");
  const original = Date.now;
  Date.now = () => now.getTime();
  try {
    assert.equal(daysUntil("2026-07-02"), 2);
    assert.equal(daysUntil("2026-06-30"), 0);
  } finally {
    Date.now = original;
  }
});

test("daysUntil returns MAX_SAFE_INTEGER for invalid date", () => {
  assert.equal(daysUntil("not-a-date"), Number.MAX_SAFE_INTEGER);
});
