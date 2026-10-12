/**
 * TEARSHEETS product-decision demonstration, written with fictional inputs.
 *
 * This is newly written showcase code, NOT a copy of the private application.
 * No network, database, image download, publishing endpoint, or external API.
 *
 * TRUST CONTRACT:
 * - `candidate` is untrusted discovery output (it may contain false claims).
 * - `checks` is a separate, trusted evidence-assessment result, supplied by
 *   a caller that must have authenticated its source and verified photo links.
 * - `actor` is authenticated by a hypothetical outer service, NOT by this demo.
 * - This model does not perform actual HTML/caption parsing or authorization.
 */

const SUPPORTED_STATUSES = new Set(["complete", "complete_bounded", "failed"]);
const SUPPORTED_DECISIONS = new Set(["mine", "hide", "not_mine", "clear"]);
const APPROVED_CREDIT = "own_caption";
const AGENCY_REUSE = "known_agency_id";

const requiredString = (value, name) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} must be a nonempty string`);
  }
  return value;
};

function canonicalArticleUrl(url) {
  const value = requiredString(url, "articleUrl");
  let result;
  try {
    result = new URL(value);
  } catch {
    throw new TypeError("articleUrl must be an absolute HTTPS URL");
  }
  if (result.protocol !== "https:" || result.username || result.password) {
    throw new TypeError("articleUrl must be HTTPS without URL credentials");
  }
  result.hash = "";
  return result.toString();
}

function checkActor(actor, tenantId, role) {
  // In production, this must be derived from an authenticated session.
  // Never accept a caller's unverified assertion about their role or tenant.
  if (actor?.role !== role || actor.tenantId !== tenantId) {
    throw new Error("authorization required for this tenant and action");
  }
}

function evaluateEvidence(candidate, trustedCheck, tenant) {
  if (!trustedCheck) {
    return { disposition: "ignored", reason: "trusted evidence absent" };
  }
  // All identifiers must bind to the exact page and photograph assessed.
  // The model's own labels and claimed credit fields are ignored.
  if (trustedCheck.tenantId !== tenant.id ||
      trustedCheck.useId !== candidate.useId ||
      trustedCheck.photoId !== candidate.photoId ||
      trustedCheck.articleUrl !== candidate.articleUrl) {
    return { disposition: "ignored", reason: "evidence identity mismatch" };
  }
  if (!trustedCheck.authorized || !trustedCheck.mediaValid ||
      !trustedCheck.imageOnArticle || trustedCheck.excluded) {
    return { disposition: "ignored", reason: "authorization, media, or exclusion stop" };
  }

  if (trustedCheck.creditLocation === APPROVED_CREDIT &&
      trustedCheck.creditedTenantId === tenant.id) {
    return { disposition: "credited", reason: "credit attached to this photograph" };
  }
  if (trustedCheck.creditLocation === AGENCY_REUSE &&
      trustedCheck.matchedPhotoId === candidate.photoId &&
      tenant.knownPhotoIds.has(candidate.photoId)) {
    return { disposition: "credited", reason: "recognized use of known photograph" };
  }

  if (trustedCheck.creditLocation === "other_photographer") {
    return { disposition: "ignored", reason: "another photographer is credited" };
  }
  return { disposition: "unchecked", reason: "insufficient image-specific credit" };
}

function copyUse(use) {
  return {
    ...use,
    providers: [...use.providers],
    runEvidence: use.runEvidence.map(entry => ({
      ...entry, providers: [...entry.providers],
    })),
    sourceRunIds: [...use.sourceRunIds],
  };
}

/**
 * A single publication use may be discovered by multiple runs.
 * Retain each run's contribution so withdrawing one never destroys a
 * different run's evidence for the same use.
 */
function recalculateUse(use) {
  const providers = new Set();
  for (const entry of use.runEvidence) {
    for (const provider of entry.providers) providers.add(provider);
  }
  return {
    ...use,
    providers: [...providers].sort(),
    disposition: use.runEvidence.some(x => x.disposition === "credited")
      ? "credited" : "unchecked",
    sourceRunIds: [...new Set(use.runEvidence.map(x => x.runId))].sort(),
    generation: Math.max(...use.runEvidence.map(x => x.generation)),
  };
}

export class ShowcaseArchive {
  #tenants = new Map();

  registerTenant({ tenantId, knownPhotoIds = [] }) {
    requiredString(tenantId, "tenantId");
    if (this.#tenants.has(tenantId)) {
      throw new Error("tenant already exists");
    }
    this.#tenants.set(tenantId, {
      id: tenantId,
      knownPhotoIds: new Set(knownPhotoIds),
      uses: new Map(),
      photographerDecisions: new Map(),
      decisionHistory: [],
      acceptedRuns: new Set(),
      generation: 0,
    });
  }

  #tenant(tenantId) {
    const tenant = this.#tenants.get(tenantId);
    if (!tenant) throw new Error("unknown tenant");
    return tenant;
  }

  /**
   * Apply one completed run. A failed run publishes nothing.
   * Import idempotence and decision precedence are independent controls.
   */
  importRun({ tenantId, runId, generation, status, candidates, checks }) {
    const tenant = this.#tenant(tenantId);
    requiredString(runId, "runId");
    if (!Number.isSafeInteger(generation) || generation < 1) {
      throw new TypeError("generation must be a positive integer");
    }
    if (!SUPPORTED_STATUSES.has(status)) throw new TypeError("invalid run status");
    if (!Array.isArray(candidates) || !checks || typeof checks !== "object" ||
        Array.isArray(checks)) {
      throw new TypeError("candidates and trusted checks must have valid shapes");
    }

    if (status === "failed") {
      return { status: "failed_preserved", changed: 0 };
    }
    const replayKey = `${runId}/${generation}`;
    if (tenant.acceptedRuns.has(replayKey)) {
      return { status: "replay_ignored", changed: 0 };
    }
    if (generation <= tenant.generation) {
      return { status: "stale_ignored", changed: 0 };
    }

    // Validate every candidate before any writes: malformed or cross-tenant
    // requests cannot leave a partially applied import.
    const prepared = candidates.map(candidate => {
      if (!candidate || candidate.tenantId !== tenantId) {
        throw new Error("candidate belongs to another tenant");
      }
      const useId = requiredString(candidate.useId, "useId");
      const photoId = requiredString(candidate.photoId, "photoId");
      const articleUrl = canonicalArticleUrl(candidate.articleUrl);
      const publisher = requiredString(candidate.publisher, "publisher");
      const provider = requiredString(candidate.provider, "provider");
      return { tenantId, useId, photoId, articleUrl, publisher, provider };
    });

    const proposedUses = new Map(
      [...tenant.uses].map(([key, use]) => [key, copyUse(use)])
    );
    const counters = { credited: 0, unchecked: 0, ignored: 0 };

    for (const candidate of prepared) {
      const trustedCheck = Object.prototype.hasOwnProperty.call(checks, candidate.useId)
        ? checks[candidate.useId] : null;
      const result = evaluateEvidence(candidate, trustedCheck, tenant);
      counters[result.disposition] += 1;

      if (result.disposition === "ignored") continue;

      const previous = proposedUses.get(candidate.useId);
      if (previous &&
          (previous.photoId !== candidate.photoId ||
           previous.articleUrl !== candidate.articleUrl ||
           previous.publisher !== candidate.publisher)) {
        throw new Error("one useId cannot describe different photographs or articles");
      }
      const runEvidence = previous?.runEvidence ?? [];
      const existing = runEvidence.find(entry => entry.runId === runId);
      if (existing) {
        existing.disposition = existing.disposition === "credited" ||
          result.disposition === "credited" ? "credited" : "unchecked";
        existing.providers = [...new Set([...existing.providers, candidate.provider])];
        existing.generation = generation;
      } else {
        runEvidence.push({
          runId, generation,
          disposition: result.disposition,
          providers: [candidate.provider],
        });
      }
      proposedUses.set(candidate.useId, recalculateUse({
        tenantId,
        useId: candidate.useId,
        photoId: candidate.photoId,
        articleUrl: candidate.articleUrl,
        publisher: candidate.publisher,
        runEvidence,
      }));
    }

    tenant.uses = proposedUses;
    tenant.generation = generation;
    tenant.acceptedRuns.add(replayKey);
    return { status, changed: counters.credited + counters.unchecked, counters };
  }

  /**
   * Human decisions are stored in a separate ledger keyed by photographer
   * and photograph. Future imports cannot mutate this ledger.
   */
  decide({ tenantId, photoId, decision, actor }) {
    const tenant = this.#tenant(tenantId);
    checkActor(actor, tenantId, "photographer");
    requiredString(photoId, "photoId");
    if (!SUPPORTED_DECISIONS.has(decision)) {
      throw new TypeError("invalid photographer decision");
    }
    if (decision === "clear") tenant.photographerDecisions.delete(photoId);
    else tenant.photographerDecisions.set(photoId, decision);
    tenant.decisionHistory.push({ photoId, decision, sequence: tenant.decisionHistory.length + 1 });
  }

  /**
   * Retire one run's currently derived records, without rolling back
   * unrelated runs, tenants, or photographer decisions.
   */
  withdrawRun({ tenantId, runId, actor }) {
    const tenant = this.#tenant(tenantId);
    checkActor(actor, tenantId, "operator");
    requiredString(runId, "runId");
    let removed = 0;
    for (const [useId, use] of tenant.uses) {
      const surviving = use.runEvidence.filter(entry => entry.runId !== runId);
      if (surviving.length === use.runEvidence.length) continue;
      if (surviving.length === 0) {
        tenant.uses.delete(useId);
        removed += 1;
      } else {
        tenant.uses.set(useId, recalculateUse({
          ...use, runEvidence: surviving,
        }));
      }
    }
    return { status: "withdrawn", removed };
  }

  snapshot(tenantId) {
    const tenant = this.#tenant(tenantId);
    const results = { published: [], queue: [], hidden: [], excluded: [] };
    for (const item of tenant.uses.values()) {
      const decision = tenant.photographerDecisions.get(item.photoId);
      const view = { ...copyUse(item), label: "" };
      if (decision === "not_mine") {
        view.label = "photographer says not mine";
        results.excluded.push(view);
      } else if (decision === "hide") {
        view.label = "hidden by photographer";
        results.hidden.push(view);
      } else if (decision === "mine") {
        view.label = "added by photographer";
        results.published.push(view);
      } else if (item.disposition === "credited") {
        view.label = "credited";
        results.published.push(view);
      } else {
        view.label = "unchecked";
        results.queue.push(view);
      }
    }
    for (const entries of Object.values(results)) {
      entries.sort((a, b) => a.useId.localeCompare(b.useId));
    }
    return {
      tenantId,
      lastAppliedGeneration: tenant.generation,
      decisions: Object.fromEntries(tenant.photographerDecisions),
      results,
    };
  }
}
