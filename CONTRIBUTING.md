# Contributing to MCP UI

Thank you for your interest in contributing to MCP UI! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Git** for version control

### Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mcp-ui.git
   cd mcp-ui
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Build all packages:
   ```bash
   pnpm build
   ```

5. Run tests to ensure everything works:
   ```bash
   pnpm test
   ```

## 📝 Development Workflow

### Making Changes

1. Create a new branch for your feature or fix:
   ```bash
   git checkout -b feature/my-new-feature
   # or
   git checkout -b fix/bug-description
   ```

2. Make your changes in the appropriate package:
   - `mcp-ui-solid/` - SolidJS components
   - `mcp-ui-spec/` - Schemas and specifications
   - `mcp-ui-cli/` - CLI tooling

3. Run tests continuously during development:
   ```bash
   pnpm test:watch
   ```

4. Ensure your code passes all checks:
   ```bash
   pnpm typecheck  # TypeScript compilation
   pnpm lint       # ESLint checks
   pnpm test       # All tests
   ```

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or updates
- `chore`: Build process or tooling changes
- `perf`: Performance improvements

**Scopes:**
- `solid` - Changes to @mcp-ui/solid
- `spec` - Changes to @mcp-ui/spec
- `cli` - Changes to @mcp-ui/cli
- `docs` - Documentation changes
- `ci` - CI/CD changes

**Examples:**
```bash
feat(solid): add support for custom component themes
fix(spec): correct validation for nested composites
docs(readme): update installation instructions
chore(ci): add automated npm publishing
```

### Testing

- Write unit tests for new features
- Maintain or improve code coverage
- Test in multiple environments when applicable
- Include edge cases in your tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @mcp-ui/solid test

# Watch mode for development
pnpm --filter @mcp-ui/spec test:watch

# Check coverage
pnpm test:coverage
```

## 📦 Package Guidelines

### @mcp-ui/solid

- Use SolidJS primitives and patterns
- Ensure components are accessible (a11y)
- Provide TypeScript types for all exports
- Include comprehensive JSDoc comments
- Support both ESM and CommonJS

### @mcp-ui/spec

- All schemas must be defined with Zod first
- Export JSON schemas for broader compatibility
- Maintain backward compatibility
- Document breaking changes clearly
- Include migration guides for major versions

### @mcp-ui/cli

- Commands should be intuitive and well-documented
- Provide helpful error messages
- Include progress indicators for long operations
- Support `--help` and `--version` flags
- Test CLI in various terminal environments

## 🔍 Code Review Process

1. Push your changes to your fork
2. Open a Pull Request against `main` branch
3. Ensure CI checks pass
4. Address review comments
5. Maintainer will merge when approved

### PR Checklist

- [ ] Tests pass locally and in CI
- [ ] Code follows project style guidelines
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow conventional format
- [ ] No breaking changes (or clearly documented)
- [ ] Type definitions updated
- [ ] CHANGELOG.md updated for user-facing changes

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Description**: Clear description of the issue
2. **Steps to Reproduce**: Minimal reproduction steps
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**:
   - Node.js version
   - pnpm version
   - OS and version
   - Package versions

## 💡 Feature Requests

Feature requests are welcome! Please:

1. Search existing issues first
2. Describe the problem you're trying to solve
3. Explain why this feature would be useful
4. Provide examples or mockups if possible

## 🏗️ Architecture Decisions

For significant changes:

1. Open an issue for discussion first
2. Explain the motivation and design
3. Consider backward compatibility
4. Document the decision in `/docs`

## 📚 Documentation

Good documentation is crucial:

- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Include code examples
- Update TypeScript types
- Document edge cases and gotchas

## 🔐 Security

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. Email security@theseedship.com
3. Include detailed description
4. Wait for acknowledgment before disclosure

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be recognized in:
- CHANGELOG.md for their contributions
- README.md contributors section
- GitHub's built-in contributors page

## ❓ Questions?

- Open a [GitHub Discussion](https://github.com/theseedship/mcp-ui/discussions)
- Join our Discord community (coming soon)
- Check existing issues and documentation

---

**Thank you for contributing to MCP UI!** 🎉
