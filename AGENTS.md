# pi-mono-shared

Public, read-only snapshot of selected pi_mono projects. Each project lives in exactly
one top-level subdirectory and is self-contained: run its commands from its directory
and read its own `AGENTS.md`/`README.md` if it has one.

## Rules

- **Don't edit project files here.** pi_mono (private) is the source; changes made here
  are overwritten by the next sync. Make the change in pi_mono, merge it to `main`,
  then run `./sync.sh --push`.
- **Adding or removing a project**: edit `PROJECTS` in `sync.sh`, update its one-line
  entry in `README.md`, and run `./sync.sh`. Check the project for secrets, personal
  paths and private data before its first sync.
- **CI workflows** live in `.github/workflows/` at the root (GitHub only reads them
  there), named `<project>-<job>.yml`; `sync.sh` copies each project's workflows.
