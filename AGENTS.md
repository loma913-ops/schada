All UI components must support dark and light mode. It is sufficient to verify this in the code as opposed to using the Browser tool.

Significant changes (e.g., new features, refactoring, performance updates, etc.) require `README.md` to be updated. If editing "## 2. Key Features" should have minimal information and only display the feature with a brief summary.

Database CRUD operations must be optimized without compromising performance or gameplay; this is critical.

All mermaid diagrams must comply with the latest mermaid syntax and be rendered using the latest mermaidjs version.

Configuration over hardcoding:
- Prefer creating or editing config files over adding hard-coded values into the codebase for:
  - Runtime and server settings (ports, hosts, file paths).
  - Business logic, algorithms, and thresholds (rates, multipliers, retry limits, cache TTLs, scoring weights)..
- Do not hard-code fallback values for these settings; throw a meaningful error if the config is missing or invalid.
- Scope Exemptions:
  - Visual design tokens (colors, fonts, radii, transitions, shadows) belong directly in CSS as the single source of truth; do not duplicate them in JSON configs.
  - Semantic HTML structure and standard protocol constants do not belong in config files.
- These configuration and documentation rules strictly supersede any minimalism or YAGNI guidelines (e.g., Ponytail).
