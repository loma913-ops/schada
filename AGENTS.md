
## General Instructions

Database CRUD operations must be optimized without compromising performance or gameplay; this is critical. The number of db operations must be kept as low as possible.

When deploying the User must not have to empty cache or do a hard reload to see the changes.

This project must be built for web, android and ios. The same codebase must be used for all platforms.

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

## Security Instructions: How to Think About & Code Security

### 1\. Core Security Mental Models (How to Think About Security)

* **Zero-Trust Client Mindset**: The client runtime (browser, React components, state stores, LocalStorage) must always be treated as hostile and fully attacker-controlled. Client-side input validation, disabled buttons, or type checks exist purely for UX. They provide **zero security**. Every access control, data validation, and state transition rule must be enforced authoritatively at the database boundary or backend service layer.  
* **Red Team Pre-Flight Validator**: Before finalizing any code that reads, writes, updates, or deletes data, the LLM must mentally adopt an adversarial posture and answer:  
  1. *What happens if an unauthenticated user sends this exact query via curl or the Firestore REST API?*  
  2. *What happens if an authenticated player modifies their payload in DevTools to include unexpected keys (e.g. `isAdmin: true`, `eloRating: 9999`, `isPatron: true`)?*  
  3. *Can this operation be looped 100,000 times by an automated script to cause a Denial-of-Wallet / Firestore billing spike?*  
* **Defense in Depth**: Security must not rely on a single defensive layer (e.g., relying solely on obscure document IDs or client-side routing guards). Security requires layered controls: HTTP security headers \+ transport encryption \+ database authorization rules \+ schema validators \+ configuration constraints.  
* **Harmonize Security with DB Performance**: Respect the core repository mandate: *"Database CRUD operations must be optimized without compromising performance or gameplay; the number of db operations must be kept as low as possible."* Security rules must use efficient field-level comparisons and `request.auth` checks rather than adding extra document reads (`get()` calls in Firestore rules incur billing and latency).

### 2\. Database & Data Security Principles (How to Address & Code Database Operations)

* **Deny by Default**: Any collection or field not explicitly authorized must be rejected.  
* **Field-Level Mutation Guards**: Never use `allow update: if isOwner(...)` without restricting the mutable keys. Always use `.diff(resource.data).affectedKeys()` to explicitly permit only expected fields.  
* **PII Segregation**: Never store private user data (such as email addresses, IP logs, or payment metadata) in documents that are publicly readable. Public profile data (`username`, `eloRating`, `avatar`, `stats`) must be strictly segregated from private user account documents.  
* **Immutable Fields Protection**: Critical fields (such as `id`, `createdAt`, `isRanked`, `bluePlayer.id`, `greenPlayer.id`) must be strictly immutable once created.  
* **Payload & Resource Limits**: Prevent Resource Exhaustion and Denial-of-Wallet attacks by enforcing string length bounds, array length caps, and type checks on every create/update operation.  
* **Configuration Over Hardcoding**: Store all security limits (max usernames, rate bounds, timeout windows, token lengths) in central configuration files (e.g. `securityConfig.ts`), throwing explicit errors on missing values.

### 3\. Frontend & Web Security Principles (How to Code UI & Networking)

* **Strict Content Security Policy (CSP)**: Ensure scripts, styles, and connections are locked to required origins (self, Firebase, Google Fonts, Stripe).  
* **Clickjacking Prevention**: Enforce `X-Frame-Options: DENY` (and `frame-ancestors 'none'`) across all hosting routes.  
* **No Unsafe DOM APIs**: Prohibit `dangerouslySetInnerHTML`, `eval()`, `new Function()`, and raw script injection.  
* **Cache-Busting Compatibility**: Never set aggressive browser caching on HTML or service worker files that would violate the deployment rule: *"When deploying the User must not have to empty cache or do a hard reload to see the changes."*
