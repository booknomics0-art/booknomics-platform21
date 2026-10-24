import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "wrangler.jsonc"), "utf8"));

describe("Cloudflare staging isolation", () => {
  it("keeps staging traffic off production domains", () => {
    expect(config.env.staging.workers_dev).toBe(true);
    expect(config.env.staging.routes).toEqual([]);
    expect(config.env.staging.vars.BOOKNOMICS_ENV).toBe("staging");
    expect(config.vars.BOOKNOMICS_ENV).toBe("production");
  });

  it("never binds previews or staging to production D1/R2", () => {
    const prodDatabase = config.d1_databases[0].database_id;
    const prodBuckets = new Set(config.r2_buckets.map((bucket: { bucket_name: string }) => bucket.bucket_name));
    for (const environment of [config.previews, config.env.staging]) {
      expect(environment.d1_databases[0].database_id).not.toBe(prodDatabase);
      for (const bucket of environment.r2_buckets) {
        expect(prodBuckets.has(bucket.bucket_name)).toBe(false);
      }
    }
  });
});
