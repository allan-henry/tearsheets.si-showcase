/**
 * Read-only demonstration from entirely fictional JSON records.
 * Usage: node examples/run-demo.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ShowcaseArchive } from "../src/archive.mjs";

const filename = fileURLToPath(
  new URL("./synthetic-publisher-records.json", import.meta.url)
);
const data = JSON.parse(readFileSync(filename, "utf8"));
if (data.synthetic !== true) {
  throw new Error("Only explicitly synthetic demonstration fixtures are allowed");
}

const archive = new ShowcaseArchive();
for (const tenant of data.tenants) archive.registerTenant(tenant);
const imported = data.runs.map(run => ({
  run: run.runId,
  result: archive.importRun(run),
}));

const first = data.tenants.map(({ tenantId }) => archive.snapshot(tenantId));

for (const { tenantId, photoId, decision } of data.photographerActions) {
  archive.decide({
    tenantId, photoId, decision,
    actor: { role: "photographer", tenantId },
  });
}
const afterPhotographerDecisions = data.tenants.map(
  ({ tenantId }) => archive.snapshot(tenantId)
);

const replay = archive.importRun(data.runs[0]);
const failed = archive.importRun({
  ...data.runs[0],
  runId: "synthetic-failed-run",
  generation: 2,
  status: "failed",
});

console.log(JSON.stringify({
  synthetic: true,
  imported,
  first,
  afterPhotographerDecisions,
  repeatImport: replay,
  failedRun: failed,
}, null, 2));
