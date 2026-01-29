# 1. record architecture decisions

date: 2026-01-29

## status

accepted

## context

we're evolving gmail-invoice-sync from a one-shot script to a production service. architectural decisions will compound — documenting them prevents re-litigating settled questions and helps future contributors understand constraints.

## decision

we will use Architecture Decision Records, as described by [Michael Nygard](http://thinkrelevance.com/blog/2011/11/15/documenting-architecture-decisions).

ADRs live in `doc/adr/` with sequential numbering: `0001-short-title.md`.

## consequences

- every significant decision gets documented
- ADRs are immutable once accepted; superseded ADRs link to their replacement
- low overhead: ~10 minutes per ADR
