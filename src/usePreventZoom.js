import { useEffect } from "react";

// iOS Safari ignores the viewport meta's user-scalable=no for pinch gestures
// (an intentional accessibility override since iOS 10), so blocking it there
// requires intercepting the gesture events directly.
export function usePreventPinchZoom() {
  useEffect(() => {
    function preventGesture(e) { e.preventDefault(); }
    function preventMultiTouch(e) {
      if (e.touches.length > 1) e.preventDefault();
    }
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("touchmove", preventMultiTouch, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("touchmove", preventMultiTouch);
    };
  }, []);
}
