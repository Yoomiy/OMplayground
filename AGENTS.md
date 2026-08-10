# Resource constraints

This project runs on a resource-constrained machine. Do not run TypeScript checks (`tsc`) or npm build commands concurrently. Run only one CPU- and memory-intensive validation/build command at a time, and wait for it to finish before starting another.
