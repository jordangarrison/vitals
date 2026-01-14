# Contributing to Vitals

Thank you for your interest in contributing to Vitals! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/vitals.git
   cd vitals
   ```
3. Install dependencies:
   ```bash
   bun install
   ```
4. Initialize the database:
   ```bash
   bun run db:init
   ```

## Development Setup

### Using Nix (Recommended)

```bash
nix develop
# or with direnv
direnv allow
```

### Without Nix

Ensure you have [Bun](https://bun.sh/) installed:
```bash
curl -fsSL https://bun.sh/install | bash
```

## Running the Project

```bash
# Development server with auto-reload
bun run dev

# Run tests
bun test

# Type check
bunx tsc --noEmit
```

## Making Changes

1. Create a new branch for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and ensure:
   - Tests pass (`bun test`)
   - Code follows existing patterns and style
   - New features include appropriate tests

3. Commit your changes with a clear message:
   ```bash
   git commit -m "Add feature: description of what you added"
   ```

4. Push to your fork and open a pull request

## Adding New Data Sources

We welcome contributions that add support for new health data sources! To add a new importer:

1. Create a new directory under `src/importers/your-source/`
2. Implement the parser following existing patterns (see `src/importers/apple-health/` for reference)
3. Add the importer to `src/importers/index.ts`
4. Update the CLI in `src/cli.ts` with appropriate flags
5. Add tests for your parser
6. Update the README with documentation

## Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Keep functions focused and well-named
- Add comments for complex logic
- Use meaningful variable names

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Include a clear description of what the PR does
- Reference any related issues
- Ensure all tests pass
- Update documentation if needed

## Reporting Issues

When reporting issues, please include:
- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Bun version, etc.)

## Questions?

Feel free to open an issue for questions or discussions about potential contributions.

## License

By contributing to Vitals, you agree that your contributions will be licensed under the MIT License.
