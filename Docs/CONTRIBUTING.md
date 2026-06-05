# Contributing to Waste Oil Management System

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the Waste Oil Management System project.

## Getting Started

### Prerequisites

- **Python 3.9+**
- **Node.js 18+** and **npm 9+**
- **Rust** (only for Tauri development)
- **Git**

### Install Rust (required for Tauri)

Linux/macOS:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version
cargo --version
```

Windows (PowerShell):

```powershell
winget install --id Rustlang.Rustup -e
rustc --version
cargo --version
```

If `winget` is unavailable, install rustup from:
- https://rustup.rs/

### Installation and Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/waste-oil-management.git
   cd inventry-management
   ```

2. **Backend installation and setup**:

   Linux/macOS:
   ```bash
   cd waste_oil_backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements/dev.txt
   cp .env.example .env
   python manage.py migrate
   python manage.py seed_workflow_demo
   ```

   Windows PowerShell:
   ```powershell
   cd waste_oil_backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements\dev.txt
   Copy-Item .env.example .env
   python manage.py migrate
   python manage.py seed_workflow_demo
   ```

3. **Run services**:

   Start backend:
   ```bash
   cd waste_oil_backend
   source .venv/bin/activate  # Windows: .\.venv\Scripts\Activate.ps1
   python manage.py runserver 0.0.0.0:8000
   ```

   Start frontend (choose one):

   **Electron**:
   ```bash
   cd waste_oil_desktop
   npm install
   cp .env.example .env
   npm run dev
   ```

   **Tauri** (requires Rust):
   ```bash
   cd waste_oil_desktop-TAURI
   npm install
   cp .env.example .env
   npm run dev
   ```

4. **Default local URLs**:
   - Backend API: `http://127.0.0.1:8000`
   - Electron Vite dev server: `http://127.0.0.1:5173`
   - Tauri Vite dev server: `http://127.0.0.1:1420`

## Code Style & Standards

### Python (Backend)

- Follow [PEP 8](https://pep8.org/)
- Use type hints where appropriate
- Format with `black` (if available)
- Max line length: 100 characters (Django convention)
- Write docstrings for all public functions and classes

Example:
```python
def process_record(record_id: str, user: CustomUser) -> WasteOilRecord:
    """
    Process a waste oil record through the workflow.
    
    Args:
        record_id: UUID of the record
        user: Authenticated user making the request
        
    Returns:
        Updated WasteOilRecord instance
    """
    # Implementation
```

### JavaScript/React (Frontend)

- Use functional components with hooks
- Use camelCase for variable/function names
- Use PascalCase for component names
- Keep components focused and small (<300 lines when possible)
- Write meaningful comments for complex logic
- Use arrow functions consistently

Example:
```javascript
export function RecordDetail({ recordId }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchRecord(recordId).then(data => {
      setRecord(data);
      setLoading(false);
    });
  }, [recordId]);
  
  if (loading) return <Spinner />;
  
  return <div>/* component */</div>;
}
```

### Rust (Tauri)

- Follow [Rust naming conventions](https://rust-lang.github.io/api-guidelines/naming.html)
- Use `rustfmt` for formatting
- Write doc comments for public APIs

## Branching Strategy

- `main` - Production-ready code
- `develop` - Development branch (default for PRs)
- `feature/your-feature` - Feature branches
- `fix/your-fix` - Bug fix branches
- `docs/your-docs` - Documentation updates

Branch naming convention: `type/short-description`
- Types: `feature`, `fix`, `docs`, `refactor`, `test`, `chore`

Example: `feature/add-user-roles-ui`, `fix/record-forwarding-bug`

## Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Keep commits atomic and logically organized
   - Write clear, descriptive commit messages
   - Reference issues when applicable: "Fixes #123"

3. **Test your changes**:
   - Backend: Run Django tests where applicable
   - Frontend: Test in both Electron and Tauri if changes affect shared code
   - Manual testing in the UI

4. **Keep your branch updated**:
   ```bash
   git fetch origin
   git rebase origin/develop
   ```

## Commit Messages

Use clear, conventional commit messages:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

Examples:
- `feat(records): add bulk record upload`
- `fix(workflow): correct stage transition logic`
- `docs(readme): update setup instructions`
- `refactor(api): simplify permission checks`

## Pull Requests

1. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a PR** on GitHub:
   - Title: Brief description of changes
   - Description: 
     - What was changed and why
     - Link to related issues
     - Screenshots for UI changes
     - Testing steps
   - Reference issues: "Closes #123"

3. **PR Requirements**:
   - All tests pass
   - Code review approval
   - No merge conflicts
   - Clear commit history

## Testing

### Backend Tests

```bash
cd waste_oil_backend
python manage.py test
```

### Frontend Component Tests

```bash
cd waste_oil_desktop  # or waste_oil_desktop-TAURI
npm run test
```

### Manual Testing

Test the full workflow:
1. Backend running on port 8000
2. Frontend (Electron or Tauri) running
3. Login with demo credentials
4. Create a test record
5. Move it through the complete workflow

## Workflow Demo Data

After running `seed_workflow_demo`, use these credentials:

| Stage | Username | Role | Password |
|-------|----------|------|----------|
| 1 | storeman | Storeman | Demo12345 |
| 2 | treatment | Treatment | Demo12345 |
| 3 | waste_admin | Admin | Demo12345 |
| 4 | manager | Manager | Demo12345 |
| 5 | gm | GM | Demo12345 |

## Reporting Issues

When reporting bugs, include:
- **Title**: Clear, concise description
- **Environment**: OS, browser/app version, backend URL
- **Reproduction steps**: Step-by-step to reproduce
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happened
- **Screenshots/logs**: Error messages or relevant output

## Documentation

- Update `.md` files for user-facing changes
- Add docstrings to new Python functions/classes
- Add JSDoc comments to exported React functions
- Update README if adding new features or dependencies

## Design Decisions

Document significant decisions in comments:

```python
# We batch record updates instead of individual saves for performance
# See: ADR-001-batch-updates.md
```

## Deployment

Deployments are handled by project maintainers. Before a release:
- Ensure all PRs are merged to `main`
- Update version numbers
- Update CHANGELOG.md
- Create a git tag

## Questions?

- Check existing issues and PRs
- Open a discussion for feature requests
- Reach out to maintainers

---

**Thank you for contributing to make Waste Oil Management System better!**
