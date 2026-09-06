# Resource constraints

This project runs on a resource-constrained machine. Do not run TypeScript checks (`tsc`) or npm build commands concurrently. Run only one CPU- and memory-intensive validation/build command at a time, and wait for it to finish before starting another.

# Logging requirements

When adding or changing a feature, endpoint, socket event, background job,
external integration, or process lifecycle, follow `docs/LOGGING.md`. Treat its
privacy rules, correlation requirements, persistence/acknowledgement contract,
and merge checklist as repository requirements.

# Theming & UI component requirements

When creating, updating, or styling any component, page, modal, or game UI,
follow `docs/THEMING_AND_COMPONENTS.md`. Treat its light-mode-default contract,
contrast rules, border conventions, form styling, and verification checklist as
repository requirements.
