"""Checks that Python packing/unprojection matches the TypeScript helpers."""

from __future__ import annotations

import math
import unittest

from geometry import (
    pack_depth_metres,
    pack_depth_to_rg,
    unpack_depth_from_rg,
    unpack_depth_metres,
    unproject_pixel,
)

K = (500.0, 500.0, 320.0, 180.0)
DEPTH_SCALE = 0.001


class GeometryTests(unittest.TestCase):
    def test_pack_round_trip(self) -> None:
        packed = pack_depth_metres(4.25, DEPTH_SCALE)
        self.assertAlmostEqual(unpack_depth_metres(packed, DEPTH_SCALE), 4.25, places=3)

    def test_rg_round_trip(self) -> None:
        packed = pack_depth_metres(12.5, DEPTH_SCALE)
        r, g = pack_depth_to_rg(packed)
        self.assertAlmostEqual(
            unpack_depth_from_rg(r, g, DEPTH_SCALE),
            12.5,
            places=3,
        )

    def test_principal_point(self) -> None:
        x, y, z = unproject_pixel(320, 180, 5, K)
        self.assertAlmostEqual(x, 0.0, places=8)
        self.assertAlmostEqual(y, 0.0, places=8)
        self.assertAlmostEqual(z, -5.0, places=8)

    def test_offset_pixel(self) -> None:
        x, y, z = unproject_pixel(420, 230, 10, K)
        self.assertAlmostEqual(x, ((420 - 320) / 500) * 10, places=8)
        self.assertAlmostEqual(y, -((230 - 180) / 500) * 10, places=8)
        self.assertAlmostEqual(z, -10.0, places=8)


if __name__ == "__main__":
    unittest.main()
