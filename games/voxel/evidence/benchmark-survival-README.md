# Retired historical survival comparison

`benchmark-survival.ts.txt` preserves the former `tools/benchmark-survival.ts`
byte for byte. Its archived/current implementation comparison is development
history, rather than a maintained benchmark of the shipped movement protocol.
The active tool and its `benchmark:survival` npm command were retired during PR
preparation. CI continues to use the independent packaged worker workload via
`benchmark:survival:workers` and `check:survival:workers`.

The executable tool and all five historical baselines can be recovered together
at commit `f19bccfa19797d57ec7243fe17fa85ebf7f2aea7`. Earlier archive documents
describe commands at their own historical snapshots. This text copy does not
provide a runnable entry point at its new location.
