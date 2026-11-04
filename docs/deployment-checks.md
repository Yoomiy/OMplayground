# Frontend deployment checks

The `Deployment checks` workflow publishes one commit status:
`Vercel - o-mplayground-game-server: checks`.
It stays pending until both push workflows, `Voxel runtime` and `Classroom service`,
finish successfully for the same commit and branch. A failed or canceled workflow
fails the gate. This covers runtime, resilience, image and classroom checks.
The source workflows run on every push so a required status cannot be left waiting
for a workflow skipped by path filters. Pull-request checks retain their path filters.

In the Vercel project, open **Settings → Build and Deployment → Deployment Checks**,
choose **Add Checks**, and require the status above. It will appear after the first
push containing this workflow. Keep automatic production-domain assignment enabled.
The workflow alone does not enable the Vercel setting.
After retrying failed CI on the same commit, rerun `Deployment checks` as well.

Vercel may build while CI runs. Deployment Checks hold production promotion and
domain assignment until the selected checks pass; they do not delay the build.
This does not add a production or preview deployment command, change branch
protection, or configure Railway services.

See [Vercel Deployment Checks](https://vercel.com/docs/deployment-checks).
