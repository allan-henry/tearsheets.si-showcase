# TEARSHEETS.SI — AI-assisted product development

**A product case study in automating publication discovery, preserving trustworthy attribution, and giving photographers control over their published work.**

**[See Allan Henry's existing public Tearsheet](https://tearsheets.si)** · **[Explore the runnable synthetic demonstration](#try-the-public-demonstration)** · **[Read the product decisions](docs/PRODUCT-DECISIONS.md)**

> **What this repository is:** a public, newly written demonstration of selected product decisions. The real TEARSHEETS application, infrastructure, source history, publisher evidence, and customer records are maintained separately. This code does **not** power the live site.

## The product

Photographs keep traveling after they have been delivered to a wire service, editor, or publication. Their creator often has no dependable record of where a particular image appeared, how it was credited, or how frequently it was reused. Reconstructing that history by hand becomes another assignment.

I created TEARSHEETS to close that gap: retrieve credited publication appearances, keep the evidence connected to the photograph, and give its photographer a continuously useful record without requiring them to upload and organize everything themselves.

The product challenge is not simply finding search results. It is deciding **which evidence is trustworthy enough to show**, how to preserve the photographer's decisions, and how to keep an automated service useful when sources are incomplete or wrong.

## What has been built (October 2026)

The private working project has progressed beyond an isolated archive demonstration into a **controlled beta** with connected photographer and operator experiences. This is a status summary, not a claim of a generally available subscription launch.

| Area | Implemented private-beta capability and boundary |
| --- | --- |
| **Photographer onboarding** | A four-stage journey: enter a published article URL → select the photograph and credit → see a bounded discovery preview → save. The preview can show the seed image plus up to nine additional candidates when available; it does not claim complete coverage. |
| **Waitlist and invitation** | Persisted applications, invitation-controlled admission, email verification, and an existing hosted-payment handoff for eligible invited users. Opening the journey to unrestricted public traffic is a separate release decision. |
| **Attribution and publication history** | Image-specific caption/credit evidence, candidate review, deduplication, and multiple documented publication uses associated with a photograph. Search results alone are not proof of authorship. |
| **Photographer controls** | **Mine**, **Not mine**, and **Hide** decisions distinguish attribution from visibility and prevent later automation from silently reversing the photographer's choice. |
| **Member and operator experience** | A member review workspace and operator dashboard for applications, invitations, admission, discovery status, and items needing attention, with administrative actions kept separate from public access. |
| **Website integration** | A new product site and URL/domain integration have been designed and are undergoing draft review. They should **not** be mistaken for a publicly launched product website or open enrollment. |

The platform uses Cloudflare Workers/Pages and persistent storage in the private implementation, with separate discovery, editorial-control, and customer-facing responsibilities. The public demonstration below intentionally omits those infrastructure services.

## My role: product direction through implementation

TEARSHEETS grew out of my work as an assignment photographer, but the work is product development across user experience, operations, software architecture, reliability, and trust.

I defined the customer problem and workflows; set the requirements for source evidence, corrections, acceptance tests, and operating costs; and directed AI-assisted development through bounded GitHub issues, pull requests, test evidence, and independent reviews. I made the decisions about what could be automated, where a person must remain accountable, and what required explicit release authorization.

Three decisions illustrate the approach:

1. **Precision ahead of recall.** A credit elsewhere on an article is not necessarily a credit for the displayed image. Uncertain results stay reviewable instead of being presented as verified.
2. **Human judgment outlasts automation.** When a photographer marks an image Not mine or Hide, subsequent discoveries must respect that choice. Separate *what was discovered* from *what the photographer chooses to display*.
3. **Test the failure path and the handoff.** Bounded search budgets, repeat-safe imports, tenant isolation, rollback discipline, and real browser journeys matter as much as a successful demo. AI coding agents can accelerate implementation without taking release authority away from the owner.

These choices are documented in [Product Decisions and Acceptance Criteria](docs/PRODUCT-DECISIONS.md). They are design and engineering judgments, not asserted revenue, accuracy, or customer time-saved metrics.

## Try the public demonstration

**This repository contains a small, synthetic, zero-dependency JavaScript model—not the actual private application.** It uses fictional photographers, publication URLs, article records and photograph IDs. It never contacts publishers, downloads photographs, calls an AI model, creates a customer account, or makes a paid request.

Requires Node.js 20 or later:

```bash
npm test
npm run demo
```

The demo shows candidates moving through an independent trusted-evidence check, photographer decisions, deduplicated publication uses, bounded imports, replay protection, and failure recovery. A failed run leaves the last accepted record intact.

| Inspect | File |
| --- | --- |
| Example decision engine | [`src/archive.mjs`](src/archive.mjs) |
| Synthetic publisher records | [`examples/synthetic-publisher-records.json`](examples/synthetic-publisher-records.json) |
| Automated test cases | [`tests/archive.test.mjs`](tests/archive.test.mjs) |
| Product decisions and trade-offs | [`docs/PRODUCT-DECISIONS.md`](docs/PRODUCT-DECISIONS.md) |

```text
Untrusted discovery candidates
              ↓
Independent evidence + media eligibility
              ↓
     Bounded, idempotent import
              ↓
  Photographer-specific photo record
              ↓
        Mine / Hide / Not mine
              ↓
       Curated published history
```

**Boundary of the example:** The `trusted` evidence and actor identity are supplied by the test fixture. This example is **not** an authentication system, a caption parser, a production accuracy evaluation, or an implementation of D1/R2, publisher fetching, image licensing, payment, or live background harvesting.

## Current scope and disclosure

- The public [tearsheets.si](https://tearsheets.si) address shows the existing photography Tearsheet; it should not be confused with the not-yet-public product-site rollout.
- Real beta access, admission, billing, and photographer publication are controlled. The complete self-service, multi-photographer launch is **not** claimed as generally available.
- The runnable code and fictional fixtures in this repository are newly authored AI-assisted examples, not an export of confidential production files. No real photographs, customer information, original media, search artifacts, credentials, or private deployment materials are included.
- Tests here validate the deliberately limited model. They do not establish measured recall, real-world precision, cost savings, or reliability at production scale.
- Public visibility does not grant a software license; redistribution rights remain reserved unless a license is expressly added.

**The goal is a publication history a photographer can trust and correct—without making its maintenance another unpaid assignment.**
