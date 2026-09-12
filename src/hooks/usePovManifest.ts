import { useEffect, useState } from 'react';
import { POV_MANIFEST_URL } from '../lib/tennis/streamMedia';
import type { PovManifest } from '../scene/pointcloud/types';

export interface UsePovManifestResult {
  readonly manifest: PovManifest | null;
  readonly loaded: boolean;
}

export function usePovManifest(): UsePovManifestResult {
  const [manifest, setManifest] = useState<PovManifest | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(POV_MANIFEST_URL)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: PovManifest | null) => {
        if (!cancelled) {
          setManifest(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setManifest(null);
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { manifest, loaded };
}
