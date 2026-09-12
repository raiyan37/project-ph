#!/usr/bin/env python3
"""Reconstruct a player-eye POV dataset from a tennis broadcast clip.

Pipeline:
  1. Estimate per-frame depth (Depth Anything V2) or synthesize a stand-in.
  2. Track people (YOLO) and label near/far via bbox height in the frame,
     optionally confirmed with Backboard → TwelveLabs/Gemini.
  3. Lift foot pixels through depth into Three.js camera space.
  4. Write rgb.mp4, lossless packed-depth webm, and manifest.json.

Examples:
  python preprocessing/pov/reconstruct.py --synthetic --end 90 --out public/tennis/pov
  python preprocessing/pov/reconstruct.py --video path/to/clip.mp4 --end 90 --out public/tennis/pov
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from geometry import unproject_pixel

DEPTH_SCALE = 0.001
EYE_HEIGHT = 1.7
DEFAULT_WIDTH = 640
DEFAULT_HEIGHT = 360
DEFAULT_FPS = 15


def estimate_intrinsics(width: int, height: int) -> tuple[float, float, float, float]:
    fx = 0.9 * float(width)
    fy = fx
    return (fx, fy, width / 2.0, height / 2.0)


def encode_bgr_frames(
    path: Path,
    frames: list[np.ndarray],
    fps: float,
    lossless: bool,
) -> None:
    if not frames:
        raise ValueError("No frames to encode")
    height, width = frames[0].shape[:2]
    path.parent.mkdir(parents=True, exist_ok=True)
    if lossless:
        command = [
            "ffmpeg",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "bgr24",
            "-s",
            f"{width}x{height}",
            "-r",
            str(fps),
            "-i",
            "-",
            "-c:v",
            "libvpx-vp9",
            "-lossless",
            "1",
            "-pix_fmt",
            "gbrp",
            str(path),
        ]
    else:
        command = [
            "ffmpeg",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "bgr24",
            "-s",
            f"{width}x{height}",
            "-r",
            str(fps),
            "-i",
            "-",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "18",
            str(path),
        ]
    process = subprocess.Popen(
        command,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    assert process.stdin is not None
    try:
        for frame in frames:
            process.stdin.write(np.ascontiguousarray(frame, dtype=np.uint8).tobytes())
        process.stdin.close()
        stderr = process.stderr.read() if process.stderr else b""
        code = process.wait()
    finally:
        if process.stdin and not process.stdin.closed:
            process.stdin.close()
    if code != 0:
        raise RuntimeError(f"ffmpeg failed for {path}: {stderr.decode('utf-8', errors='replace')}")


def depth_to_bgr(depth_metres: np.ndarray, depth_scale: float) -> np.ndarray:
    packed = np.clip(np.rint(depth_metres / depth_scale), 0, 65535).astype(np.uint32)
    packed[depth_metres <= 0] = 0
    high = (packed // 256).astype(np.uint8)
    low = (packed % 256).astype(np.uint8)
    bgr = np.zeros((*depth_metres.shape, 3), dtype=np.uint8)
    # OpenCV BGR: we store packed R in the red channel, G in green.
    bgr[:, :, 2] = high
    bgr[:, :, 1] = low
    return bgr


def make_synthetic_clip(
    seconds: float,
    width: int,
    height: int,
    fps: float,
) -> tuple[list[np.ndarray], list[np.ndarray], list[dict[str, Any]], tuple[float, float, float, float]]:
    frame_count = max(1, int(round(seconds * fps)))
    k = estimate_intrinsics(width, height)
    rgb_frames: list[np.ndarray] = []
    depth_frames: list[np.ndarray] = []
    tracks: list[dict[str, Any]] = []

    court = np.zeros((height, width, 3), dtype=np.uint8)
    court[:, :] = (46, 110, 72)
    court[height // 2 - 2 : height // 2 + 2, :] = (230, 240, 220)
    court[:, width // 2 - 1 : width // 2 + 1] = (230, 240, 220)

    for index in range(frame_count):
        t = index / fps
        phase = t * 0.55
        near_u = 210 + 40 * math.sin(phase)
        near_v = 270 + 16 * math.cos(phase * 0.7)
        far_u = 430 + 28 * math.sin(phase + 0.8)
        far_v = 128 + 12 * math.cos(phase * 0.5)
        near_depth = 5.1 + 0.25 * math.sin(phase)
        far_depth = 11.6 + 0.35 * math.cos(phase)

        depth = np.full((height, width), 14.0, dtype=np.float32)
        yy, xx = np.mgrid[0:height, 0:width]
        depth += ((yy / height) * 4.0).astype(np.float32)

        rgb = court.copy()
        rgb[: height // 3] = (38, 52, 48)
        paint_player(rgb, depth, near_u, near_v, near_depth, (80, 70, 190), 18, 36)
        paint_player(rgb, depth, far_u, far_v, far_depth, (160, 90, 40), 12, 26)

        rgb_frames.append(rgb)
        depth_frames.append(depth_to_bgr(depth, DEPTH_SCALE))
        tracks.append(
            {
                "t": t,
                "near": sample_for_pixel(near_u, near_v, near_depth, k),
                "far": sample_for_pixel(far_u, far_v, far_depth, k),
            }
        )

    return rgb_frames, depth_frames, tracks, k


def paint_player(
    rgb: np.ndarray,
    depth: np.ndarray,
    u: float,
    v: float,
    depth_metres: float,
    bgr: tuple[int, int, int],
    half_width: int,
    half_height: int,
) -> None:
    height, width = rgb.shape[:2]
    x0 = int(max(0, round(u) - half_width))
    x1 = int(min(width, round(u) + half_width))
    y0 = int(max(0, round(v) - half_height))
    y1 = int(min(height, round(v) + half_height))
    rgb[y0:y1, x0:x1] = bgr
    depth[y0:y1, x0:x1] = depth_metres


def sample_for_pixel(
    u: float,
    v: float,
    depth_metres: float,
    k: tuple[float, float, float, float],
) -> dict[str, Any]:
    foot = unproject_pixel(u, v, depth_metres, k)
    position = (foot[0], foot[1] + EYE_HEIGHT, foot[2])
    return {
        "pixel": [round(u, 3), round(v, 3)],
        "position": [round(position[0], 5), round(position[1], 5), round(position[2], 5)],
    }


def load_video_frames(video_path: Path, end: float, width: int, height: int, fps: float) -> list[np.ndarray]:
    import cv2

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise FileNotFoundError(f"Could not open video: {video_path}")
    source_fps = capture.get(cv2.CAP_PROP_FPS) or fps
    frames: list[np.ndarray] = []
    frame_index = 0
    next_t = 0.0
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        t = frame_index / source_fps
        frame_index += 1
        if t < next_t:
            continue
        if t > end:
            break
        resized = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)
        frames.append(resized)
        next_t += 1.0 / fps
    capture.release()
    if not frames:
        raise RuntimeError(f"No frames decoded from {video_path}")
    return frames


def estimate_depth_frames(rgb_frames: list[np.ndarray]) -> list[np.ndarray]:
    try:
        import torch
        from transformers import pipeline
    except ImportError as error:
        raise RuntimeError(
            "Depth Anything V2 requires torch and transformers. "
            "Install them or pass --synthetic."
        ) from error

    device = 0 if torch.cuda.is_available() else -1
    estimator = pipeline(
        task="depth-estimation",
        model="depth-anything/Depth-Anything-V2-Small-hf",
        device=device,
    )
    packed: list[np.ndarray] = []
    for frame in rgb_frames:
        rgb = frame[:, :, ::-1]
        result = estimator(rgb)
        depth = np.array(result["predicted_depth"] if isinstance(result, dict) else result)
        depth = depth.astype(np.float32)
        if depth.shape[:2] != rgb.shape[:2]:
            import cv2

            depth = cv2.resize(depth, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_LINEAR)
        # Relative depth: scale so median sits around 8 metres.
        median = float(np.median(depth[depth > 0])) or 1.0
        metres = (median / np.maximum(depth, 1e-6)) * 8.0
        packed.append(depth_to_bgr(metres, DEPTH_SCALE))
    return packed


def track_players(
    rgb_frames: list[np.ndarray],
    depth_bgr_frames: list[np.ndarray],
    fps: float,
    k: tuple[float, float, float, float],
    depth_scale: float,
) -> list[dict[str, Any]]:
    try:
        from ultralytics import YOLO
    except ImportError as error:
        raise RuntimeError(
            "YOLO tracking requires ultralytics. Install it or pass --synthetic."
        ) from error

    model = YOLO("yolov8n.pt")
    tracks: list[dict[str, Any]] = []
    for index, frame in enumerate(rgb_frames):
        results = model.track(
            source=frame,
            persist=True,
            tracker="bytetrack.yaml",
            conf=0.25,
            iou=0.45,
            classes=[0],
            verbose=False,
        )
        boxes = []
        result = results[0]
        if result.boxes is not None and result.boxes.xyxy is not None:
            xyxy = result.boxes.xyxy.cpu().numpy()
            for row in xyxy:
                x1, y1, x2, y2 = row.tolist()
                boxes.append((x1, y1, x2, y2, (y1 + y2) / 2.0, (x2 - x1) * (y2 - y1)))
        boxes.sort(key=lambda item: item[5], reverse=True)
        people = boxes[:2]
        people.sort(key=lambda item: item[4])
        far_box = people[0] if people else None
        near_box = people[-1] if len(people) > 1 else (people[0] if people else None)
        depth = depth_bgr_to_metres(depth_bgr_frames[index], depth_scale)
        t = index / fps
        tracks.append(
            {
                "t": t,
                "near": lift_box(near_box, depth, k) if near_box else None,
                "far": lift_box(far_box, depth, k) if far_box else None,
            }
        )
    return tracks


def depth_bgr_to_metres(frame: np.ndarray, depth_scale: float) -> np.ndarray:
    high = frame[:, :, 2].astype(np.uint16)
    low = frame[:, :, 1].astype(np.uint16)
    packed = high.astype(np.uint32) * 256 + low
    return packed.astype(np.float32) * depth_scale


def lift_box(
    box: tuple[float, float, float, float, float, float],
    depth: np.ndarray,
    k: tuple[float, float, float, float],
) -> dict[str, Any]:
    x1, y1, x2, y2, _, _ = box
    u = (x1 + x2) / 2.0
    v = y2
    sample_v = min(depth.shape[0] - 1, max(0, int(round(v)) - 1))
    sample_u = min(depth.shape[1] - 1, max(0, int(round(u))))
    depth_metres = float(depth[sample_v, sample_u])
    if depth_metres <= 0:
        patch = depth[
            max(0, int(y1)) : max(int(y1) + 1, int(y2)),
            max(0, int(x1)) : max(int(x1) + 1, int(x2)),
        ]
        positive = patch[patch > 0]
        depth_metres = float(np.median(positive)) if positive.size else 0.0
    return sample_for_pixel(u, v, depth_metres, k)


def maybe_label_with_gemini(video_path: Path) -> dict[str, Any] | None:
    try:
        from script import process_video
    except Exception:
        preprocessing = ROOT / "preprocessing"
        if str(preprocessing) not in sys.path:
            sys.path.insert(0, str(preprocessing))
        try:
            from script import process_video
        except Exception:
            return None
    try:
        return process_video(
            str(video_path),
            extract_coordinates=True,
            raw_output=False,
        )
    except Exception:
        return None


def write_manifest(
    out_dir: Path,
    k: tuple[float, float, float, float],
    tracks: list[dict[str, Any]],
    fps: float,
    width: int,
    height: int,
) -> None:
    manifest = {
        "rgbUrl": "/tennis/pov/rgb.mp4",
        "depthUrl": "/tennis/pov/depth.webm",
        "fps": fps,
        "width": width,
        "height": height,
        "depthScale": DEPTH_SCALE,
        "K": [k[0], k[1], k[2], k[3]],
        "eyeHeight": EYE_HEIGHT,
        "hideRadius": 0.45,
        "tracks": tracks,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a tennis POV reconstruction dataset")
    parser.add_argument("--video", type=Path, help="Local broadcast clip")
    parser.add_argument("--synthetic", action="store_true", help="Generate a stand-in RGB-D clip")
    parser.add_argument("--end", type=float, default=90.0, help="Seconds to process from t=0")
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH)
    parser.add_argument("--height", type=int, default=DEFAULT_HEIGHT)
    parser.add_argument("--fps", type=float, default=DEFAULT_FPS)
    parser.add_argument(
        "--out",
        type=Path,
        default=ROOT / "public" / "tennis" / "pov",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    out_dir = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.synthetic or args.video is None:
        rgb_frames, depth_frames, tracks, k = make_synthetic_clip(
            args.end,
            args.width,
            args.height,
            args.fps,
        )
    else:
        rgb_frames = load_video_frames(args.video, args.end, args.width, args.height, args.fps)
        depth_frames = estimate_depth_frames(rgb_frames)
        k = estimate_intrinsics(args.width, args.height)
        tracks = track_players(rgb_frames, depth_frames, args.fps, k, DEPTH_SCALE)
        labels = maybe_label_with_gemini(args.video)
        if labels:
            (out_dir / "gemini-labels.json").write_text(json.dumps(labels, indent=2))

    encode_bgr_frames(out_dir / "rgb.mp4", rgb_frames, args.fps, lossless=False)
    encode_bgr_frames(out_dir / "depth.webm", depth_frames, args.fps, lossless=True)
    write_manifest(out_dir, k, tracks, args.fps, args.width, args.height)
    print(f"Wrote POV dataset to {out_dir} ({len(rgb_frames)} frames)")


if __name__ == "__main__":
    main()
