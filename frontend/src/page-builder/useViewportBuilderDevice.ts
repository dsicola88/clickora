import { useEffect, useState } from "react";
import type { DeviceType } from "./types";
import {
  BUILDER_MOBILE_MAX_PX,
  BUILDER_TABLET_MAX_PX,
  viewportToBuilderDevice,
} from "./responsiveDefaults";

/**
 * Device do builder alinhado à largura real do viewport (página pública / preview).
 * No SSR / 1.º paint usa `desktop` e actualiza após mount (evita mismatch).
 */
export function useViewportBuilderDevice(): DeviceType {
  const [device, setDevice] = useState<DeviceType>("desktop");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setDevice(viewportToBuilderDevice(window.innerWidth));
    sync();
    const mqMobile = window.matchMedia(`(max-width: ${BUILDER_MOBILE_MAX_PX}px)`);
    const mqTablet = window.matchMedia(`(max-width: ${BUILDER_TABLET_MAX_PX}px)`);
    mqMobile.addEventListener("change", sync);
    mqTablet.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      mqMobile.removeEventListener("change", sync);
      mqTablet.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return device;
}
