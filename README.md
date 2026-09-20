# Scene It

A 3D Gaussian Splat scene viewer built with Next.js and PlayCanvas.

## Prerequisites

- Node.js 18+
- [GitHub CLI](https://cli.github.com/) (`gh`) authenticated against `ghe.oculus-rep.com`

## Setup

```bash
git clone https://ghe.oculus-rep.com/bhuynh22/scene-it.git
cd scene-it
npm install
```

### Download scene assets

Scene files (PLY, GLB) are too large for git and are hosted on a GitHub Release instead. Pull them down with:

```bash
./download-assets.sh
```

This places files into `public/scenes/<scene-id>/`. You only need to run it once (or again if the owner updates the assets).

### Run locally

```bash
npm run dev
```

## Deployment

```bash
npm run deploy
```

## Updating scene assets (repo owner only)

After adding or changing scene files in `public/scenes/`, push them to the GitHub Release:

```bash
npm run upload-assets
```
