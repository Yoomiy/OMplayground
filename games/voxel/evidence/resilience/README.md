# Resilience qualification

> Historical record for its stated build. Redundant source copies, generated bundles
> and raw captures were trimmed from this PR branch. The full originals remain on
> `dev/voxel-runtime-rewrite`; see the [archive index](../README.md) for recovery.

[qualification.json](qualification.json) records the local qualification of
release `b9438158d0e39dd5ff78fd132075324385a119b268c01975e28d5dc51aef30f5`.
The final two-player workload ran for 3,604,904 ms with injected optional-service
failures and TCP input holds. Both players retained their original gameplay
connections, completed 212 edits, and disposed their resources successfully.
All 53 input holds recovered locally; no client errors or action retries occurred.

The report also contains the separate real TCP snapshot-stall/readmission check,
the React cached-chat/session outage journey with measured recorded audio output,
focused test counts, and raw-report hashes. The broader unit/Wasm and packaged
integration checks retained eight failures reproduced in the unchanged baseline;
their files and the implementation checked are listed explicitly.

These checks use local fault-injectable providers and software Chromium. They
establish recovery behavior, not hosted provider connectivity or device performance.
See [the contract and commands](../../docs/resilience.md) to reproduce the checks.
Raw reports are generated under the ignored `test-results` directories and are
uploaded by the resilience CI job.
