"""Geometry helpers that match src/scene/pointcloud/unproject.ts."""

from __future__ import annotations

UINT16_MAX = 65535


def pack_depth_metres(metres: float, depth_scale: float = 0.001) -> int:
    if metres <= 0 or depth_scale <= 0:
        return 0
    packed = round(metres / depth_scale)
    return min(UINT16_MAX, max(0, packed))


def unpack_depth_metres(packed: int, depth_scale: float = 0.001) -> float:
    if packed <= 0 or depth_scale <= 0:
        return 0.0
    return packed * depth_scale


def pack_depth_to_rg(packed: int) -> tuple[int, int]:
    value = max(0, min(UINT16_MAX, int(packed)))
    return value // 256, value % 256


def unpack_depth_from_rg(r: int, g: int, depth_scale: float = 0.001) -> float:
    packed = int(r) * 256 + int(g)
    return unpack_depth_metres(packed, depth_scale)


def unproject_pixel(
    u: float,
    v: float,
    depth_metres: float,
    k: tuple[float, float, float, float],
) -> tuple[float, float, float]:
    if depth_metres <= 0:
        return (0.0, 0.0, 0.0)
    fx, fy, cx, cy = k
    x = ((u - cx) / fx) * depth_metres
    y = ((v - cy) / fy) * depth_metres
    return (x, -y, -depth_metres)
