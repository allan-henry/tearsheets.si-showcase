# TEARSHEETS: product decisions and acceptance criteria

This case study describes how I framed the product and operational tradeoffs. The code in this showcase is a **synthetic illustration** of some of those rules. Product intentions, implemented private-pilot capabilities, and outcomes not yet measured are deliberately distinguished.

## 1. Solve the unpaid job, not the portfolio interface

**Customer observation:** Photographers often cannot easily reconstruct when and where already-delivered images were used. Manually searching, organizing, and maintaining a publication history takes time that does not produce another assignment.

**Product choice:** Make discovery and archive maintenance the core job. A photographer can later curate the display, but the service should be useful even if they rarely sign in.

**Alternative considered:** Make users upload photographs and maintain their own portfolio content. That would be simpler to build but shift the work back to the customer.

**Success signals to measure:** Credible new publication uses found, coverage against known examples, time spent correcting results, and operator workload. Session counts alone are a poor proxy for value. These are measurement requirements, **not reported customer outcomes**.

## 2. Mostly right and easy to correct

**Problem:** Search results include unrelated images, credits floating elsewhere on a page, agency catalog pages, and duplicate links to the same article.

**Product choice:** Only an image-specific credit or a recognized agency ID tied to a known photograph qualifies for automatic display. A page-level credit is insufficient. Uncertain records stay unchecked without stopping the rest of the run.

**Tradeoff:** This will miss some genuine uses. The customer-visible cost of falsely attributing somebody else's photograph is greater than the cost of leaving one real result in a review queue.

**Acceptance tests illustrated here:** A model's unsupported attribution cannot publish; another photographer's credit is ignored; page-level credit remains queued; two providers pointing to the same publication use create one record.

**Boundary:** This demo receives its image-specific evidence as a separately supplied trusted fixture. It does not implement the real caption parser or prove attribution accuracy on live web pages.

## 3. Photographer controls must outlast automation

**Problem:** A user can correct a wrong image today, only to have tomorrow's automated search import it again.

**Product choice:** Store Hide, Not Mine and Mine separately from discovery/import records and make these decisions take precedence when the archive is displayed. Make Not Mine tenant-specific. Hide is a choice about visibility, not ownership.

**Acceptance tests illustrated here:** A later import cannot undo a Hide choice; Mine can make an unchecked, already media-eligible candidate visible with the appropriate label; one photographer's Not Mine does not erase another photographer's publication record.

**Real-world caveat:** Authorization and photographer identity must be verified by the actual service. The showcase trusts caller-provided identities solely to illustrate decision precedence.

## 4. Fail safely without rolling back unrelated work

**Problem:** Harvesting involves third-party responses, timeouts, media checks and budgets. A single failed attempt must not destroy an already functioning archive.

**Product choice:** Use distinct run outcomes: complete, complete-but-bounded, and failed. A failed run makes no publication changes; a bounded run can retain qualifying results. Repeat imports are idempotent, and older generations do not supersede newer ones.

**Alternative considered:** Treat every partial result as failure, or allow a failed operation to overwrite a previously good state. Both increase customer work and operator risk.

**Acceptance tests illustrated here:** Replayed runs do not duplicate uses; old generations are ignored; a failed run preserves the last accepted state; withdrawing one run's records leaves other runs and photographer decisions intact.

**Boundary:** The showcase uses in-memory transactions. It is not a replacement for persistent storage, transactional outboxes, signed operations, retention rules, backups, or production rollback procedures.

## 5. Coordinate AI-assisted development without giving it release authority

**Observed issue:** Independent AI coding and review sessions created extra coordination work and incompatible assumptions unless requirements and ownership were shared.

**Operating change:** Product principles became the source of truth for decisions. Distinct AI contributors work within bounded scopes and use GitHub issues, separate branches, tested changes, and pull-request review. I decide what is accepted, merged, deployed, and run.

**Example tradeoff:** I chose a shared process for multiple search providers earlier than recommended by two technical reviews, to avoid retrofitting deduplication and attribution later. Per-provider settings and yield reporting were intended to limit cost and preserve reversibility. That is a documented strategic choice, not proof the choice has produced superior results.

**What I learned:** Tests and code completion are inputs to product acceptance. The product must also generate credible publication histories with manageable customer effort.

## Implications for product management

The same principles transfer beyond professional photography: distinguish a successful automated action from a dependable customer outcome, put ownership close to the person affected, let a partial failure degrade gracefully, and prevent later system changes from undoing a deliberate human decision.

The underlying work is **problem definition, quality criteria, prioritization, cross-functional collaboration, and measured iteration**. The narrow code example exists to make those decisions inspectable rather than merely asserted.

**Provenance:** The full TEARSHEETS product, source history, contributor discussions, and actual customer/publisher records remain private. This document is a human-readable synthesis of owner-stated product decisions. The accompanying code is newly written, AI-assisted demonstration code, not the private implementation.
