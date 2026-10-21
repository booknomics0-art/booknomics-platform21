import { describe, expect, it } from "vitest";
import { PLANS, SELLABLE_PLANS, FEATURES } from "../src/lib/plans";

describe("Booknomics affordable Premium", () => {
  it("offers only ₹19 weekly and ₹49 monthly memberships", () => {
    expect(SELLABLE_PLANS).toEqual(["weekly", "monthly"]);
    expect(PLANS.weekly.amountPaise).toBe(1900);
    expect(PLANS.weekly.price).toBe(19);
    expect(PLANS.monthly.amountPaise).toBe(4900);
    expect(PLANS.monthly.price).toBe(49);
  });
  it("preserves quarterly as legacy but not a newly offered plan", () => {
    expect(PLANS.quarterly.price).toBe(199);
    expect(SELLABLE_PLANS).not.toContain("quarterly");
  });
  it("does not put weekly buyers on a less capable Premium tier than monthly", () => {
    FEATURES.forEach((feature) => expect(feature.weekly).toBe(feature.monthly));
  });
});
