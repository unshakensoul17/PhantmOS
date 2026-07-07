# 🤝 Contributing to PhantmOS

We love your input! We want to make contributing to PhantmOS as easy and transparent as possible, whether it's:
- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

## 🌿 Branching Strategy

We use a standard Git Flow style branching strategy:
- `main`: The stable production branch.
- `develop`: The active development branch.
- `feature/*`: New features (e.g., `feature/add-linkedin-harvester`).
- `bugfix/*`: Bug fixes (e.g., `bugfix/fix-pdf-margins`).
- `docs/*`: Documentation updates.

## 📝 Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/). This leads to more readable messages that are easy to follow when looking through the project history.

Format:
```
<type>(<scope>): <subject>
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests

**Example:**
`feat(agents): add intelligent rate limit backoff to ResumeAgent`

## 🔄 Pull Request Workflow

1. **Fork the repo** and create your branch from `develop`.
2. **Implement your changes.**
3. **Ensure tests pass** (if applicable).
4. **Update documentation** if your change adds or modifies behavior (API endpoints, environment variables, etc.).
5. **Issue a Pull Request** against the `develop` branch.
6. **Code Review**: At least one maintainer must review and approve the PR.

## 💻 Coding Standards

### Python (Backend)
- Code must be compatible with Python 3.12+.
- Use strict type hinting (`-> dict`, `list[str]`, etc.).
- Docstrings are mandatory for all Agents and Core modules.
- Do not add business logic to `dashboard.py` or `main_orchestrator.py`; delegate logic to the `agents/` folder.
- Use `core.logger` instead of standard `print()`.

### React (Frontend)
- Use functional components and React Hooks.
- Prefer TailwindCSS (v4) utility classes over custom CSS files.
- Follow the established Radix UI component abstractions in `src/components`.
- Use standard TypeScript interfaces for API payloads.

## ✅ Review Checklist

Before marking your PR as ready for review, verify:
- [ ] Code follows the naming conventions (snake_case for Python, camelCase/PascalCase for TypeScript).
- [ ] Environment variable changes are documented in `.env.example` and `ENVIRONMENT.md`.
- [ ] No hardcoded sensitive secrets exist in the code.
- [ ] You have run frontend linters (`npm run lint`).
