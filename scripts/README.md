# Scripts Directory

This directory contains utility scripts for development and deployment.

## Available Scripts

### `run.sh`
**Purpose:** Nix development environment launcher  
**Usage:** `./run.sh`  
**Description:** Launches the bot using Nix develop environment with xvfb-run for headless browser support.

**Requirements:**
- Nix package manager
- xvfb (X Virtual Framebuffer)

**Environment:**
This script is designed for NixOS or systems with Nix installed. It provides a reproducible development environment as defined in `setup/nix/flake.nix`.

---

For Docker deployment, see the `docker/` directory.  
For setup scripts, see the `setup/` directory.
