# Contributing Guide

Welcome to the **PwnDépôt** project! We are happy to have you here. 
Please follow the guidelines below to ensure a smooth workflow and high code quality.

---

## 🛠️ Prerequisites & Setup

Before contributing, ensure you have the following tools installed:
* **Docker & Docker Compose**: For running the full stack.
* **uv**: An extremely fast Python package installer and resolver. [Installation Guide](https://github.com/astral-sh/uv).
* **Node.js & npm**: For the React frontend.
* **Pre-commit**: To enforce code quality before pushing.

### 1. Setting up the Environment
After cloning the repository, set up the dependencies for both backend and frontend.

#### Backend (Python/FastAPI)
We use `uv` for dependency management.
```bash
cd app/backend
# Create virtual env and sync dependencies
uv sync
# Activate the environment
source .venv/bin/activate
```

#### Frontend (React)
```bash
cd app/frontend
npm install
```

### 2. Setting up Pre-Commit Hooks
We use `pre-commit` to automatically run linting (Ruff) and formatting checks when you commit.
```bash
# In the root of the project
pip install pre-commit  # If not installed globally
pre-commit install
```
Now, every time you run `git commit`, the hooks will verify your code quality.

---

## 🚀 Building & Running Locally

To run the entire application (Frontend + Backend + Database) locally, use Docker Compose.

```bash
# From the root directory
docker compose up --build
```

* **Frontend:** Accessible at `http://localhost:5173`
* **Backend API:** Accessible at `http://localhost:8000`
* **API Docs:** Accessible at `http://localhost:8000/docs`

---

## 🌿 Branching & PR Strategy

We follow a strict **Git Flow** variant. Please adhere to these rules:

1.  **Main Branch (`main`)**: 
    * This is the **Production** branch.
    * ❌ **NEVER** push or open a PR directly to `main`.
    * `main` is updated only via merges from `devel` upon Milestone finalization.

2.  **Development Branch (`devel`)**:
    * This is the **Integration** branch.
    * All Feature PRs must target `devel`.

3.  **Feature Branches**:
    * Create a branch for every single issue/task.
    * Naming convention: `feat/<issue-number>-short-description` or `fix/...`
    * Example: `feat/42-add-login-page`

### Workflow Summary
1.  **Pick an Issue:** Assign yourself an issue from the board.
2.  **Branch from `devel`:**
    ```bash
    git checkout devel
    git pull
    git checkout -b feat/my-new-feature
    ```
3.  **Code & Test:** Make your changes.
4.  **Push & PR:** Open a Pull Request targeting **`devel`**.
    * **Rule:** **1 Issue = 1 PR**. Do not bundle multiple unrelated features.

---

## 📂 Project Structure

```text
/
├── .github/              # CI/CD workflows, contributing guide, semantic config
├── app/                  # The main Web Application
│   ├── frontend/         # React application (Vite)
│   └── backend/          # FastAPI application (Python)
├── challenges/           # Repository of CTF Challenges
│   └── [challenge_name]/ # Specific challenge folder
├── k8s/                  # Kubernetes Manifests for deployment
├── .gitignore
└── README.md
```

---

## 📝 Commits

We enforce **Semantic Commits**. This allows us to generate changelogs and version numbers automatically.
Your commit messages must follow the syntax specified in `.github/semantic.yml`.

### Commit Format
```text
<type>(<scope>): <subject>
```

### Allowed Types
```yaml
feat       # A new feature
fix        # A bug fix
docs       # Documentation changes only
style      # Code style/formatting (no logic changes)
refactor   # Code restructuring (no behavior change)
perf       # Performance improvements
test       # Adding or updating tests
build      # Build system or dependencies
ci         # CI/CD configuration changes
chore      # Maintenance tasks (no app logic changes)
revert     # Revert a previous commit
config     # Configuration files changes
init       # Initial commit or project setup
structure  # Changes to project structure or architecture
```

### Example
```bash
git commit -m "feat(challenges): finished buffer-overflow-101"
```

---

## 🏴‍☠️ Challenges Structure

Each challenge must be placed in its own folder inside `challenges/`.
The folder should be named after the challenge and contain the following:

```text
challenges/
└── <challenge_name>/
    ├── challenge.yml    # Metadata for deployment
    ├── Dockerfile       # Container definition
    └── (other files)    # Source code, binaries, etc.
```

### `challenge.yml` Format
The file must define the following keys:

```yaml
name: <challenge_name>
difficulty: <easy|medium|hard>
category: <Web|crypto|re|forensic|other>
points: <integer>
author: <your_name>
description: <your_description_here>
```

### Flags & Dynamic Injection
* ❌ **Do not hardcode the flag** in your source code or Dockerfile.
* ✅ The flag is injected at runtime via the environment variable **`CTF_FLAG`**.
* The web application/orchestrator provides this variable when starting the container.
* **Requirement:** Your challenge code/entrypoint must read the flag from this environment variable and place it where necessary (e.g., into a file, or a database).
