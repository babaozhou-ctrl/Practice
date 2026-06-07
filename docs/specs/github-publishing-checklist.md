# GitHub Publishing Checklist

Use this checklist before opening the repository to other people.

## Repository Basics

- initialize Git locally
- create the GitHub repository
- confirm `.gitignore` is in place before the first commit
- choose and add a license
- make sure the repository name and description match the product direction
- avoid keeping the public repository under a generic name like `Practice` once the project is ready to share

## Documentation

- keep the README concise and product-facing
- add 2-4 screenshots of the desktop pet window
- add one short motion clip or GIF
- keep architecture notes in `docs/specs/` rather than crowding the README
- avoid exaggerated claims about capabilities that are still placeholder or experimental

## Before First Public Push

- remove accidental local logs
- make sure `node_modules/`, `dist/`, and release artifacts are ignored
- verify there are no private API keys, personal paths, or machine-specific secrets
- check for temporary assets or throwaway test files that do not belong in the public repo

## Quality Gates

- run `npm run typecheck`
- run `npm run build`
- regenerate pet QA assets if sprite work changed
- verify the desktop app still launches after the latest changes

## README Additions To Prepare

- short one-paragraph description
- current feature list
- current limitations
- development commands
- packaging commands
- roadmap section
- screenshot section
- contribution notes

## Suggested First Public Commit Scope

Keep the first public version focused and understandable:

- desktop window runtime
- Mochi pet package
- context-aware behavior skeleton
- chat panel
- file analysis
- roadmap and architecture docs

Avoid mixing in too many unfinished experiments in the initial public presentation.
