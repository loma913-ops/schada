# Agent Instructions

## General Instructions

ABSOLUTELY NO em-dashes (—) are permitted. Rephrasing the sentence or using parentheses are valid replacements.

Any packages added to the project must be the most recent stable release.

Database CRUD operations must be optimized without compromising performance or gameplay; this is critical. The number of db operations must be kept as low as possible.

When deploying the User must not have to empty cache or do a hard reload to see the changes.

This project must be built for web browsers (Chrome, Firefox, Opera, Safari, etc.), Android and iOS. The same codebase must be used for all platforms.

All UI components must support dark and light mode. It is sufficient to verify this in the code as opposed to using the Browser tool.

All UI components must be formatted well for desktop and mobile. It is sufficient to verify this in the code as opposed to using the Browser tool.

Significant changes (e.g., new features, refactoring, performance updates, etc.) require `README.md` to be updated. If editing "## 2. Key Features" it should have minimal information and only display the features with a brief summary.

All mermaid diagrams must comply with the latest mermaid syntax and be rendered using the latest mermaidjs version.

Configuration over hardcoding:

- Prefer creating or editing config files over adding hard-coded values into the codebase for:
  - Runtime and server settings (ports, hosts, file paths).
  - Business logic, algorithms, and thresholds (rates, multipliers, retry limits, cache TTLs, scoring weights)..
- Do not hard-code fallback values for these settings; throw a meaningful error if the config is missing or invalid.
- Scope Exemptions:
  - Visual design tokens (colors, fonts, radii, transitions, shadows) belong directly in CSS as the single source of truth.
  - Semantic HTML structure and standard protocol constants do not belong in config files.
- These configuration and documentation rules strictly supersede any minimalism or YAGNI guidelines (e.g., Ponytail).

## Architectural Principle: Pragmatic YAGNI & Evolutionary Design

When designing, writing, or refactoring code, balance immediate simplicity with structural foresight:

1. **No Speculative Bloat:** Do not build complex abstractions, generic frameworks, or deep indirection for hypothetical future features that have no clear near-term likelihood.
2. **No Short-Sighted Coupling:** Never treat YAGNI as an excuse to write tightly coupled, hardcoded, or brittle logic. Always evaluate how the current feature fits into the broader system context.
3. **Design With Seams:** Implement the simplest solution that satisfies current requirements, but structure module boundaries, interfaces, and data flow so the code can be abstracted or extended later without requiring a destructive rewrite.
4. **Low-Cost, High-Probability Abstractions:** If the domain context makes future expansion highly probable and the cost of abstracting it today is minimal, implement the clean abstraction immediately.

## Firestore Architecture & Data-Modeling Guidelines

Follow these architectural and data-modeling rules when designing, writing, or reviewing Firestore code.

### 1. Timestamps & Authoritative Clocks

- **Type:** Always use Firestore's native `Timestamp` object (normalized internally to UTC). Never store dates as ISO-8601 strings or raw epoch integers, and do not store local client timezone offsets unless local wall-clock context is explicitly required as a separate IANA timezone string field.
- **Writes:** Always use `FieldValue.serverTimestamp()` for creation, state mutations, and audit logs. Never trust client system clocks.
- **Reads:** Configure client snapshot listeners with `{ serverTimestamps: 'estimate' }` to prevent null-timestamp UI jitter during optimistic local renders.
- **Expirations & Deadlines:** Represent time-bound windows using `startedAt` (Timestamp), `durationSeconds` (Number), and `expiresAt` (Timestamp). Validate expirations strictly against server time (`request.time`).

### 2. Document Topology & Write Limits

- **Throughput Constraint:** Respect Firestore's limit of roughly 1 sustained write per second per document.
- **State vs. History Separation:**
  - `resources/{resourceId}`: Store only the current state, active status metadata, authorized user IDs, and operational bounds. Keep this document flat and bounded.
  - `resources/{resourceId}/events/{eventId}`: Record every historical mutation, activity log, or audit entry in an append-only subcollection. Never append unbounded history to an array inside the root document (avoids payload bloat, unnecessary read bandwidth, and the 1 MB document size limit).
- **Sensitive Data Isolation:** Firestore security rules operate at the document level and cannot redact individual fields. Isolate restricted data (such as PII, private notes, or user-specific secrets) in a dedicated subcollection like `resources/{resourceId}/private/{userId}` with read access restricted strictly to authorized principals.

### 3. Concurrency & State Transitions

- **Transactional Mutations:** Execute all multi-actor state transitions and concurrent updates inside Firestore Transactions (or via authoritative backend functions). Never issue blind `.update()` calls from the client when business logic depends on the current document state.
- **Optimistic Concurrency & Revision Control:** Maintain a sequential integer counter (`revision` or `version`) on mutable documents. Every state-changing transaction must verify:
  1. The resource is in a valid mutable state (for example, `resource.status == 'active'`).
  2. The caller holds the required ownership, role, or lock permission to mutate the state.
  3. `resource.revision == expectedRevision` (and increment it by 1 upon commit to prevent race conditions, lost updates, and out-of-order writes).

### 4. Security Rules & Integrity

- **Timestamp Spoof Prevention:** Enforce authoritative server timestamps in `firestore.rules` on all creation and update paths:
  `request.resource.data.createdAt == request.time` (on create) and `request.resource.data.updatedAt == request.time` (on update).
- **Authorization & Ownership Validation:** Restrict write permissions on root documents and subcollections exclusively to authenticated users verified via `request.auth.uid` against an explicit owner ID, participant list, or role map defined on the resource.

## Security Instructions: How to Think About & Code Security

### 1\. Core Security Mental Models (How to Think About Security)

- **Zero-Trust Client Mindset**: The client runtime (browser, React components, state stores, LocalStorage) must always be treated as hostile and fully attacker-controlled. Client-side input validation, disabled buttons, or type checks exist purely for UX. They provide **zero security**. Every access control, data validation, and state transition rule must be enforced authoritatively at the database boundary or backend service layer.  
- **Red Team Pre-Flight Validator**: Before finalizing any code that reads, writes, updates, or deletes data, the LLM must mentally adopt an adversarial posture and answer:  
  1. *What happens if an unauthenticated user sends this exact query via curl or the Firestore REST API?*  
  2. *What happens if an authenticated player modifies their payload in DevTools to include unexpected keys (e.g. `isAdmin: true`, `eloRating: 9999`, `isPatron: true`)?*  
  3. *Can this operation be looped 100,000 times by an automated script to cause a Denial-of-Wallet / Firestore billing spike?*  
- **Defense in Depth**: Security must not rely on a single defensive layer (e.g., relying solely on obscure document IDs or client-side routing guards). Security requires layered controls: HTTP security headers \+ transport encryption \+ database authorization rules \+ schema validators \+ configuration constraints.  
- **Harmonize Security with DB Performance**: Respect the core repository mandate: *"Database CRUD operations must be optimized without compromising performance or gameplay; the number of db operations must be kept as low as possible."* Security rules must use efficient field-level comparisons and `request.auth` checks rather than adding extra document reads (`get()` calls in Firestore rules incur billing and latency).

### 2\. Database & Data Security Principles (How to Address & Code Database Operations)

- **Deny by Default**: Any collection or field not explicitly authorized must be rejected.  
- **Field-Level Mutation Guards**: Never use `allow update: if isOwner(...)` without restricting the mutable keys. Always use `.diff(resource.data).affectedKeys()` to explicitly permit only expected fields.  
- **PII Segregation**: Never store private user data (such as email addresses, IP logs, or payment metadata) in documents that are publicly readable. Public profile data (`username`, `eloRating`, `avatar`, `stats`) must be strictly segregated from private user account documents.  
- **Immutable Fields Protection**: Critical fields (such as `id`, `createdAt`, `isRanked`, `whitePlayer.id`, `blackPlayer.id`) must be strictly immutable once created.  
- **Payload & Resource Limits**: Prevent Resource Exhaustion and Denial-of-Wallet attacks by enforcing string length bounds, array length caps, and type checks on every create/update operation.  
- **Configuration Over Hardcoding**: Store all security limits (max usernames, rate bounds, timeout windows, token lengths) in central configuration files (e.g. `securityConfig.ts`), throwing explicit errors on missing values.

### 3\. Frontend & Web Security Principles (How to Code UI & Networking)

- **Strict Content Security Policy (CSP)**: Ensure scripts, styles, and connections are locked to required origins (self, Firebase, Google Fonts, Stripe).  
- **Clickjacking Prevention**: Enforce `X-Frame-Options: DENY` (and `frame-ancestors 'none'`) across all hosting routes.  
- **No Unsafe DOM APIs**: Prohibit `dangerouslySetInnerHTML`, `eval()`, `new Function()`, and raw script injection.  
- **Cache-Busting Compatibility**: Never set aggressive browser caching on HTML or service worker files that would violate the deployment rule: *"When deploying the User must not have to empty cache or do a hard reload to see the changes."*
