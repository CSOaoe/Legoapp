# BrickForge Local AI 3D companion

This local-only FastAPI service connects BrickForge to Stability AI's Stable Fast
3D model. It runs on the user's NVIDIA GPU and returns an OBJ that the existing
BrickForge voxel and brick-packing pipeline can consume.

The service binds to `127.0.0.1:8787`, accepts one image per generation, keeps a
single GPU job active at a time, and never uploads the source image elsewhere.
Stable Fast 3D is a single-view estimator: extra photographs remain useful to
BrickForge's deterministic visual-hull mode, but they are not fused by this model.

Model weights are gated by Stability AI. Request access at
<https://huggingface.co/stabilityai/stable-fast-3d>, accept its licence, run
`scripts/login-ai3d.ps1`, and then start the companion with
`scripts/start-ai3d.ps1`.

Runtime files, weights, generated meshes, and the engine checkout live under
`.tools/` and are intentionally excluded from Git.
