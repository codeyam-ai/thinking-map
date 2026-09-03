# Security Policy

## Supported versions

Thinking Map is developed on `main` and has not yet cut a tagged release. Security
fixes land on `main`; there are no maintained release branches to backport to.

| Version | Supported |
| ------- | --------- |
| `main`  | Yes       |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** A public report
tells everyone about the hole at the same moment it tells us.

Instead, use either of these:

- **GitHub private vulnerability reporting** — the "Report a vulnerability" button
  under this repository's Security tab. This is the preferred route; it keeps the
  report, the discussion, and the eventual advisory in one place.
- **Email** — [support@codeyam.com](mailto:support@codeyam.com), with
  `thinking-map` somewhere in the subject line.

A useful report includes what an attacker can do, the steps to reproduce it, and
the commit or deployment you observed it on. A proof of concept helps; it is not
required if describing the problem is enough to act on.

## What to expect

- **Acknowledgement within 3 business days.** If you have not heard back by then,
  assume the message went astray and send it again.
- **An assessment within 10 business days** — whether we can reproduce it, how
  serious we think it is, and what we intend to do.
- **Credit, if you want it.** Tell us how you would like to be named in the
  advisory, or that you would rather not be.

We will keep you informed while a fix is being prepared, and we will let you know
before any public disclosure.

## Scope

This policy covers the code in this repository. Two areas are worth calling out
because they shape what counts as a vulnerability here:

- **The app never calls a language model itself and holds no model credentials.**
  The agent is the one you already have, and it brings its own — see
  [`AGENT_CONTRACT.md`](AGENT_CONTRACT.md). Issues in *your* agent or its provider
  are not in scope here.
- **A map is reachable by anyone holding its link.** That is the current design,
  not an oversight, and it is documented rather than defended against. A report
  that link-holders can read a map is not a vulnerability; a report that someone
  *without* the link can is.

Findings in third-party dependencies should generally go to that project. If a
dependency issue is exploitable specifically because of how this project uses it,
we want to hear about it.
