# TEARSHEETS.SI | Product decisions and automation showcase

**A fictional, runnable example of publication discovery, image attribution, photographer control, and failure recovery.**

This is a **newly written, AI-assisted product demonstration**, not the private TEARSHEETS production application. It contains invented photographers, article URLs, publications, and photograph IDs. No real photographs, customer data, publisher HTML, live APIs, or deployment secrets are included.

## The customer problem

A professional photographer's work can appear across many publications, long after the original assignment. Keeping track of those uses manually becomes another unpaid job. TEARSHEETS is intended to make that archive maintain itself, without requiring photographers to constantly upload and organize their work.

That creates a product problem: a plausible but incorrectly attributed image should **not** appear publicly under the wrong photographer's name. Yet forcing the owner to inspect every possible match would defeat the point of automation.

The product principle is **mostly right, easy to correct**. It favors precision over chasing every possible published use, leaves uncertain matches unchecked, and puts the final decision with the photographer.

## The product judgment

The core experience is a decision system, not just a search engine.

| Evidence and event | Product behavior |
| --- | --- |
| A photographer's approved credit is attached to the image's own caption | Eligible to appear automatically, assuming media and authorization checks pass |
| An agency ID links the appearance to an already known photograph | Eligible as another publication use |
| A photographer credit appears on the page but cannot be tied to this image | Unchecked. It goes to the photographer's review queue |
| Another photographer's credit is attached to the image | Not published for the current photographer |
| The photographer selects **Mine** | Published as **added by photographer** |
| The photographer selects **Hide** | Remains theirs but disappears from the visible archive |
| The photographer selects **Not Mine** | Excluded for that photographer, not for anyone else |
| A later search finds the same photograph again | Existing photographer decisions still win |
| A run fails | The previously accepted archive remains intact |
| A run finishes at its approved search budget | Qualifying results are kept; the run is reported as bounded |

These are distinct choices about customer trust, experience design, and operator workload. They are illustrated by tests, not represented as independently measured business results.

## See it work

**Requires Node.js 20 or later. No dependencies or credentials.**

```bash
npm test
npm run demo
```

The demo prints the synthetic states before and after photographer corrections, along with an ignored replay and a failed run that preserves the last accepted archive.

The tests check attribution evidence boundaries, deduplication across search providers, tenant isolation, the photographer's authority, idempotent imports, stale generations, bounded runs, bad media, and targeted recovery.

**Source:** [`src/archive.mjs`](src/archive.mjs)  
**Fictional data:** [`examples/synthetic-publisher-records.json`](examples/synthetic-publisher-records.json)  
**Tests:** [`tests/archive.test.mjs`](tests/archive.test.mjs)  
**Decision case study:** [`docs/PRODUCT-DECISIONS.md`](docs/PRODUCT-DECISIONS.md)

## Simplified architecture

```text
  Discovery results (untrusted; multiple providers)
                      |
                      v
  Independent evidence and media checks (trusted input)
                      |
                      v
             Bounded import/run
                /           \
      credited uses      unchecked queue
                \           /
                 Per-tenant archive
                        |
           Photographer decision overlay
                  /     |       \
                Mine   Hide    Not Mine
                  \     |       /
             Public / hidden / excluded views
```

The model keeps photograph-level decisions separate from publication-use records. That means a later import cannot silently undo a photographer's correction. It also separates the question **“was this photograph published here?”** from **“should this photographer display it?”**

The example uses in-memory Maps rather than D1/R2. A production implementation needs authenticated users, a trustworthy source parser, signed evidence, persistent transactions, media permissions, storage, and an actual publication system. This demonstration does **not** pretend to implement those controls.

## My role and what I learned

I started TEARSHEETS from firsthand editorial experience and defined the user problem, product requirements, customer-control rules, priorities, and review criteria. I directed AI-assisted implementation through GitHub issues and pull requests, compared competing technical recommendations, and retained approval over releases and consequential actions.

Early harvest results exposed the difference between **finding a candidate** and **finding a credible photograph attribution**. That changed the design: check image-specific evidence before treating a result as publishable, send uncertain matches to a queue, and allow exceptions without stopping all other work.

I also changed the development process when relaying instructions among AI agents became a bottleneck. The private working project uses distinct builder and reviewer responsibilities, written product principles, and a shared decision record. The PR history for this separate showcase is real, but it does not reproduce the private project's history.

### Status and limits

- TEARSHEETS has a working private archive/pilot and evolving harvesting components. This showcase is **not** evidence that the intended multi-photographer subscription platform has been fully launched.
- The code in this repository was written as a limited, AI-assisted **synthetic demonstration** of selected product rules. It is **not** presented as a copy of shipped production code.
- Its trusted evidence records are supplied by a fixture. It does not fetch or parse real publishers, inspect photographs, call a model, or identify real people.
- The example accepts a trusted caller's role and tenant identity for illustration. It is **not an authentication or authorization service**.
- Passing local tests validates the small model's stated behaviors, not attribution precision at production scale or a customer's measured time savings.
- Public repository visibility does not grant a software license. Rights and redistribution terms remain reserved unless a license is expressly added.

The working private repository, actual media, search artifacts, original code history, and operational infrastructure remain separate.

**The central product question is not whether AI can find everything. It is whether the customer can trust what the product shows and fix the exceptions without taking on another job.**
