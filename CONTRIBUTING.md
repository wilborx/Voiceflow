# Contributing to VoiceFlow-AI

Thank you for your interest in contributing to VoiceFlow-AI! This document provides guidelines and instructions for contributing.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. 

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please follow the [Bug Report Template](../.github/ISSUE_TEMPLATE/bug_report.md).

### Suggesting Enhancements

Enhancement suggestions are tracked as [Feature Requests](../.github/ISSUE_TEMPLATE/feature_request.md). When creating an enhancement suggestion, please provide as many details as possible.

### Pull Requests

- Fill in the [PR template](../.github/PULL_REQUEST_TEMPLATE.md)
- Follow the [Conventional Commits](https://www.conventionalcommits.org) format
- Include tests for new features
- Update documentation as needed
- Ensure all CI checks pass

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone <your-fork-url>`
3. Install dependencies: `pnpm install`
4. Create your feature branch: `git checkout -b feat/your-feature-name`
5. Make your changes
6. Run tests: `pnpm run typecheck && pnpm run build`
7. Commit with conventional format: `git commit -m "feat: your message"`
8. Push to your fork: `git push origin feat/your-feature-name`
9. Create a Pull Request

## Branch Naming Convention

- `feat/` for new features
- `fix/` for bug fixes
- `docs/` for documentation changes
- `refactor/` for code refactoring
- `chore/` for maintenance tasks

## DSGVO Compliance Reminder

When working with voice recordings or PII:
- Never commit real recordings or PII data
- Ensure consent management is properly implemented
- Verify audit trails for data access
- Test deletion flows thoroughly