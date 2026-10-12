import test from "node:test";
import assert from "node:assert/strict";
import { ShowcaseArchive } from "../src/archive.mjs";

const T1 = "fictional-photographer-one";
const T2 = "fictional-photographer-two";

function archive() {
  const a = new ShowcaseArchive();
  a.registerTenant({ tenantId: T1, knownPhotoIds: ["photo-1"] });
  a.registerTenant({ tenantId: T2, knownPhotoIds: [] });
  return a;
}

function candidate({
  tenantId = T1, useId = "use-1", photoId = "photo-1",
  articleUrl = `https://fictional-paper.example/${useId}`,
  publisher = "Fictional City Paper", provider = "google_images",
} = {}) {
  return {
    tenantId, useId, photoId, articleUrl, publisher, provider,
    // The model may claim anything. These assertions do not create proof.
    modelClaims: { creditLocation: "own_caption", confidence: 1 },
  };
}

function trustedCheck(c, overrides = {}) {
  return {
    tenantId: c.tenantId, useId: c.useId, photoId: c.photoId,
    articleUrl: c.articleUrl, imageOnArticle: true,
    mediaValid: true, authorized: true,
    creditLocation: "own_caption", creditedTenantId: c.tenantId,
    ...overrides,
  };
}

function importOne(a, c, overrides = {}) {
  return a.importRun({
    tenantId: c.tenantId, runId: "run-1", generation: 1,
    status: "complete", candidates: [c],
    checks: { [c.useId]: trustedCheck(c) },
    ...overrides,
  });
}

function resultCount(a, tenantId = T1, key = "published") {
  return a.snapshot(tenantId).results[key].length;
}

const photographer = tenantId => ({ role: "photographer", tenantId });
const operator = tenantId => ({ role: "operator", tenantId });

test("an image-specific credited photo can appear automatically", () => {
  const a = archive();
  const c = candidate();
  assert.equal(importOne(a, c).status, "complete");
  assert.equal(resultCount(a), 1);
  assert.equal(a.snapshot(T1).results.published[0].label, "credited");
});

test("a model's claimed attribution does not replace independent evidence", () => {
  const a = archive();
  const c = candidate();
  importOne(a, c, { checks: {} });
  assert.equal(resultCount(a), 0);
  assert.equal(resultCount(a, T1, "queue"), 0);
});

test("a credit somewhere on the article goes to the unchecked queue", () => {
  const a = archive();
  const c = candidate();
  importOne(a, c, {
    checks: { [c.useId]: trustedCheck(c, { creditLocation: "page_only" }) },
  });
  assert.equal(resultCount(a), 0);
  assert.equal(resultCount(a, T1, "queue"), 1);
  assert.equal(a.snapshot(T1).results.queue[0].label, "unchecked");
});

test("credit attached to a different photograph is not auto-published", () => {
  const a = archive();
  const c = candidate();
  importOne(a, c, {
    checks: { [c.useId]: trustedCheck(c, { creditLocation: "different_photo" }) },
  });
  assert.equal(resultCount(a), 0);
  assert.equal(resultCount(a, T1, "queue"), 1);
});

test("a known photograph's confirmed agency ID is recognized as another use", () => {
  const a = archive();
  const c = candidate();
  importOne(a, c, {
    checks: { [c.useId]: trustedCheck(c, {
      creditLocation: "known_agency_id", matchedPhotoId: "photo-1",
    }) },
  });
  assert.equal(resultCount(a), 1);
});

test("an agency ID does not auto-publish a photograph not already known", () => {
  const a = archive();
  const c = candidate({ photoId: "photo-unknown" });
  importOne(a, c, {
    checks: { [c.useId]: trustedCheck(c, {
      creditLocation: "known_agency_id", matchedPhotoId: "photo-unknown",
    }) },
  });
  assert.equal(resultCount(a), 0);
  assert.equal(resultCount(a, T1, "queue"), 1);
});

test("a credit belonging to another photographer is ignored", () => {
  const a = archive();
  const c = candidate();
  importOne(a, c, {
    checks: { [c.useId]: trustedCheck(c, {
      creditLocation: "other_photographer", creditedTenantId: T2,
    }) },
  });
  assert.equal(resultCount(a), 0);
  assert.equal(resultCount(a, T1, "queue"), 0);
});

for (const [label, change] of [
  ["missing authorization", { authorized: false }],
  ["invalid media", { mediaValid: false }],
  ["missing photograph on article", { imageOnArticle: false }],
  ["photographer exclusion", { excluded: true }],
]) {
  test(`${label} stops publication for that candidate`, () => {
    const a = archive();
    const c = candidate();
    importOne(a, c, {
      checks: { [c.useId]: trustedCheck(c, change) },
    });
    assert.equal(resultCount(a), 0);
    assert.equal(resultCount(a, T1, "queue"), 0);
  });
}

test("evidence identifying a different photograph or tenant is ignored", () => {
  const a = archive();
  const c = candidate();
  importOne(a, c, {
    checks: { [c.useId]: trustedCheck(c, {
      tenantId: T2, photoId: "wrong-photo",
    }) },
  });
  assert.equal(resultCount(a), 0);
  assert.equal(resultCount(a, T1, "queue"), 0);
});

test("two discovery providers produce one archive use with two sources", () => {
  const a = archive();
  const c = candidate();
  const yahoo = { ...c, provider: "yahoo" };
  a.importRun({
    tenantId: T1, runId: "run-1", generation: 1, status: "complete",
    candidates: [c, yahoo], checks: { [c.useId]: trustedCheck(c) },
  });
  assert.equal(resultCount(a), 1);
  assert.deepEqual(
    a.snapshot(T1).results.published[0].providers,
    ["google_images", "yahoo"],
  );
});

test("a photographer can claim an uncertain use, labeled as their addition", () => {
  const a = archive();
  const c = candidate({ photoId: "photo-2" });
  importOne(a, c, {
    checks: { [c.useId]: trustedCheck(c, { creditLocation: "page_only" }) },
  });
  assert.equal(resultCount(a, T1, "queue"), 1);
  a.decide({
    tenantId: T1, photoId: "photo-2", decision: "mine",
    actor: photographer(T1),
  });
  assert.equal(resultCount(a), 1);
  assert.equal(a.snapshot(T1).results.published[0].label, "added by photographer");
});

test("Hide applies to every use of the photograph, including new imports", () => {
  const a = archive();
  const c1 = candidate();
  importOne(a, c1);
  a.decide({
    tenantId: T1, photoId: "photo-1", decision: "hide",
    actor: photographer(T1),
  });
  const c2 = candidate({ useId: "use-2" });
  a.importRun({
    tenantId: T1, runId: "run-2", generation: 2, status: "complete",
    candidates: [c2], checks: { [c2.useId]: trustedCheck(c2) },
  });
  assert.equal(resultCount(a), 0);
  assert.equal(resultCount(a, T1, "hidden"), 2);
});

test("Not Mine belongs only to the photographer who made that decision", () => {
  const a = archive();
  const c1 = candidate();
  const c2 = candidate({ tenantId: T2 });
  importOne(a, c1);
  importOne(a, c2);
  a.decide({
    tenantId: T1, photoId: "photo-1", decision: "not_mine",
    actor: photographer(T1),
  });
  assert.equal(resultCount(a, T1, "excluded"), 1);
  assert.equal(resultCount(a, T2, "published"), 1);
});

test("a decision cannot be changed by an actor from another tenant", () => {
  const a = archive();
  const c = candidate();
  importOne(a, c);
  assert.throws(() => a.decide({
    tenantId: T1, photoId: "photo-1", decision: "hide",
    actor: photographer(T2),
  }), /authorization/);
  assert.equal(resultCount(a), 1);
});

test("operators cannot impersonate photographer editorial approval", () => {
  const a = archive();
  assert.throws(() => a.decide({
    tenantId: T1, photoId: "photo-1", decision: "mine",
    actor: operator(T1),
  }), /authorization/);
});

test("replaying an accepted run does not create duplicates or changes", () => {
  const a = archive();
  const c = candidate();
  importOne(a, c);
  const r = importOne(a, c);
  assert.deepEqual(r, { status: "replay_ignored", changed: 0 });
  assert.equal(resultCount(a), 1);
});

test("an older generation cannot override more recent publication decisions", () => {
  const a = archive();
  const c = candidate();
  importOne(a, c, { generation: 2, runId: "newer-run" });
  a.decide({
    tenantId: T1, photoId: "photo-1", decision: "hide",
    actor: photographer(T1),
  });
  const outcome = importOne(a, c, { generation: 1, runId: "older-run" });
  assert.equal(outcome.status, "stale_ignored");
  assert.equal(resultCount(a, T1, "hidden"), 1);
  assert.equal(a.snapshot(T1).lastAppliedGeneration, 2);
});

test("failed runs preserve the last good published state", () => {
  const a = archive();
  const c = candidate();
  importOne(a, c);
  const before = a.snapshot(T1);
  const result = importOne(a, c, {
    runId: "run-failed", generation: 2, status: "failed",
  });
  assert.equal(result.status, "failed_preserved");
  assert.deepEqual(a.snapshot(T1), before);
});

test("a bounded but completed run publishes qualified records", () => {
  const a = archive();
  const c = candidate();
  const result = importOne(a, c, { status: "complete_bounded" });
  assert.equal(result.status, "complete_bounded");
  assert.equal(resultCount(a), 1);
});

test("an accepted import cannot replace a useId with a different photograph", () => {
  const a = archive();
  const c1 = candidate();
  importOne(a, c1);
  const c2 = candidate({ photoId: "other-photo" });
  const before = a.snapshot(T1);
  assert.throws(() => a.importRun({
    tenantId: T1, runId: "run-2", generation: 2, status: "complete",
    candidates: [c2], checks: { [c2.useId]: trustedCheck(c2) },
  }), /cannot describe different/);
  assert.deepEqual(a.snapshot(T1), before);
});

test("a cross-tenant candidate rejects an entire import atomically", () => {
  const a = archive();
  const good = candidate();
  const foreign = candidate({ tenantId: T2, useId: "use-2" });
  assert.throws(() => a.importRun({
    tenantId: T1, runId: "run-1", generation: 1, status: "complete",
    candidates: [good, foreign],
    checks: { [good.useId]: trustedCheck(good) },
  }), /another tenant/);
  assert.equal(a.snapshot(T1).lastAppliedGeneration, 0);
  assert.equal(resultCount(a), 0);
});

test("non-HTTPS or credential-bearing article URLs are rejected", () => {
  for (const url of [
    "javascript:alert('no')", "http://unsafe.example/abc",
    "https://login:password@fictional-paper.example/abc",
  ]) {
    const a = archive();
    const c = candidate({ articleUrl: url });
    assert.throws(() => importOne(a, c), /articleUrl/);
    assert.equal(resultCount(a), 0);
  }
});

test("an import's untrusted claim cannot publish without matching checks", () => {
  const a = archive();
  const c = candidate({ photoId: "photo-new" });
  const forged = { ...c, claims: {
    authorized: true, creditedTenantId: T1,
    creditLocation: "own_caption", mediaValid: true,
  } };
  importOne(a, forged, { checks: {} });
  assert.equal(resultCount(a), 0);
});

test("withdrawal removes one run, not unrelated runs or human decisions", () => {
  const a = archive();
  const c1 = candidate();
  const c2 = candidate({ useId: "use-2", photoId: "photo-2" });
  importOne(a, c1);
  a.importRun({
    tenantId: T1, runId: "run-2", generation: 2, status: "complete",
    candidates: [c2], checks: { [c2.useId]: trustedCheck(c2) },
  });
  a.decide({
    tenantId: T1, photoId: "photo-1", decision: "hide",
    actor: photographer(T1),
  });
  const withdrawn = a.withdrawRun({
    tenantId: T1, runId: "run-2", actor: operator(T1),
  });
  assert.deepEqual(withdrawn, { status: "withdrawn", removed: 1 });
  assert.equal(resultCount(a, T1, "hidden"), 1);
  assert.equal(resultCount(a), 0);
  assert.equal(a.snapshot(T1).decisions["photo-1"], "hide");
});

test("other-tenant operators cannot withdraw archive data", () => {
  const a = archive();
  const c = candidate();
  importOne(a, c);
  assert.throws(() => a.withdrawRun({
    tenantId: T1, runId: "run-1", actor: operator(T2),
  }), /authorization/);
  assert.equal(resultCount(a), 1);
});

test("withdrawing the latest run retains an earlier run's use", () => {
  const a = archive();
  const original = candidate();
  importOne(a, original);

  const again = { ...original, provider: "bing" };
  a.importRun({
    tenantId: T1, runId: "run-2", generation: 2, status: "complete",
    candidates: [again],
    checks: { [again.useId]: trustedCheck(again) },
  });
  assert.equal(resultCount(a), 1);
  assert.deepEqual(
    a.snapshot(T1).results.published[0].sourceRunIds,
    ["run-1", "run-2"],
  );

  assert.deepEqual(a.withdrawRun({
    tenantId: T1, runId: "run-2", actor: operator(T1),
  }), { status: "withdrawn", removed: 0 });

  assert.equal(resultCount(a), 1);
  const existing = a.snapshot(T1).results.published[0];
  assert.deepEqual(existing.sourceRunIds, ["run-1"]);
  assert.deepEqual(existing.providers, ["google_images"]);
});

test("withdrawing only the strong evidence restores an earlier unchecked use", () => {
  const a = archive();
  const c = candidate();
  importOne(a, c, {
    checks: { [c.useId]: trustedCheck(c, { creditLocation: "page_only" }) },
  });
  assert.equal(resultCount(a, T1, "queue"), 1);
  a.importRun({
    tenantId: T1, runId: "run-2", generation: 2, status: "complete",
    candidates: [c], checks: { [c.useId]: trustedCheck(c) },
  });
  assert.equal(resultCount(a), 1);

  a.withdrawRun({ tenantId: T1, runId: "run-2", actor: operator(T1) });
  assert.equal(resultCount(a), 0);
  assert.equal(resultCount(a, T1, "queue"), 1);
  assert.deepEqual(a.snapshot(T1).results.queue[0].sourceRunIds, ["run-1"]);
});

test("clearing a photographer's Mine decision restores the unchecked queue", () => {
  const a = archive();
  const c = candidate();
  importOne(a, c, {
    checks: { [c.useId]: trustedCheck(c, { creditLocation: "page_only" }) },
  });
  a.decide({ tenantId: T1, photoId: "photo-1", decision: "mine", actor: photographer(T1) });
  assert.equal(resultCount(a), 1);
  a.decide({ tenantId: T1, photoId: "photo-1", decision: "clear", actor: photographer(T1) });
  assert.equal(resultCount(a), 0);
  assert.equal(resultCount(a, T1, "queue"), 1);
});
