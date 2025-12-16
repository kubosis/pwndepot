# 🚩 PwnDépôt

[![Build & Deploy](https://github.com/kubosis/pwndepot/actions/workflows/deploy.yml/badge.svg)](https://github.com/kubosis/pwndepot/actions/workflows/deploy.yml)
[![Code Quality](https://github.com/kubosis/pwndepot/actions/workflows/quality.yml/badge.svg)](https://github.com/kubosis/pwndepot/actions/workflows/quality.yml)
[![React Version](https://img.shields.io/badge/react-18.2.0-61dafb.svg?logo=react&logoColor=white)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.95+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📌 Project Overview

**PwnDépôt** is a modern, scalable infrastructure and repository for hosting **Capture The Flag (CTF)** challenges.

Unlike traditional static CTF hosting, PwnDépôt is designed as a dynamic platform where challenges can be deployed securely and independently. The project focuses on robust infrastructure-as-code principles, utilizing Kubernetes for orchestration and a "pod-per-user" architecture (currently in development) to ensure isolation and fairness during cybersecurity competitions.

### Key Features
* **Challenge Repository:** A centralized location for web, pwn, crypto, and reverse engineering challenges.
* **Modern Stack:** Built with **FastAPI** (Python) and **React** (Vite + Nginx).
* **Production Ready:** Fully containerized and orchestrated via Kubernetes.
* **Secure:** Automated TLS certificates via Let's Encrypt and cert-manager.

---

## 🚀 CI/CD & Infrastructure

This project utilizes a fully automated **GitOps** workflow to ensure stability and rapid deployment.

### Pipeline Artifacts
* **Deployment Pipeline:** Handles Docker builds, registry pushes (GHCR), and manifest updates.
    * *Status:* [![Build & Deploy](https://github.com/kubosis/pwndepot/actions/workflows/deploy.yml/badge.svg)](https://github.com/kubosis/pwndepot/actions/workflows/deploy.yml)
* **Quality Gate:** Runs linting (Ruff/ESLint), static analysis, and tests.
    * *Status:* [![Code Quality](https://github.com/kubosis/pwndepot/actions/workflows/quality.yml/badge.svg)](https://github.com/kubosis/pwndepot/actions/workflows/quality.yml)

### 🏗️ The Workflow
We use **GitHub Actions** for Continuous Integration and **ArgoCD** for Continuous Deployment.

1.  **Build & Push:**
    * On every push to `main` (or `deployment` branch), GitHub Actions builds optimized Docker images for the Backend and Frontend.
    * Images are pushed to the **GitHub Container Registry (GHCR)**.
2.  **Manifest Update:**
    * The CI pipeline automatically updates the Kubernetes manifests in the `k8s/` directory with the new image tags (SHA-pinned).
3.  **GitOps Sync (ArgoCD):**
    * **ArgoCD** watches the repository. When it detects changes in the `k8s/` manifests, it synchronizes the state of the production cluster to match the code.
4.  **Database Migrations:**
    * Before the new backend goes live, an **ArgoCD PreSync Hook** launches a temporary Kubernetes Job.
    * This job runs `alembic upgrade head` to ensure the database schema is compatible with the new deployment.

### 🛠️ Technology Stack
* **Orchestration:** Kubernetes (K8s) on Hetzner Cloud
* **Ingress:** Traefik with automatic Let's Encrypt TLS
* **Database:** PostgreSQL (StatefulSet)
* **Frontend:** React (Served via Nginx)
* **Backend:** FastAPI (Python 3.10+)

---

## 🤝 Contributing

We highly value community contributions! Whether you want to add a new CTF challenge, improve the dashboard, or optimize the infrastructure, your help is welcome.

Please read our **[Contributing Guide](.github/CONTRIBUTING.md)** before you start. It covers:
* Code standards and linting (Ruff, ESLint).
* How to create and structure new challenges.
* Pull Request process.

> **Note:** This project enforces strict branch protection. You will need to fork the repository or create a feature branch and submit a PR. Direct pushes to `main` are blocked.

---

## 💻 Local Development Setup

To run the platform locally for development purposes:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/kubosis/pwndepot.git
    cd pwndepot
    ```

2.  **Environment Setup:**
    Copy the example environment files:
    ```bash
    cp app/backend/.env.example app/backend/.env
    cp app/frontend/.env.example app/frontend/.env
    ```

3.  **Run with Docker Compose:**
    The easiest way to start the full stack (Db, Backend, Frontend) is:
    ```bash
    docker-compose up --build
    ```
    * **Frontend:** `http://localhost:5173`
    * **Backend API:** `http://localhost:8000`
    * **API Docs:** `http://localhost:8000/docs`

---

## 📜 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

