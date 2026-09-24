import { useEffect, useRef, useState } from "react";

/**
 * Cinematic system boot — the GOD'S EYE power-on sequence.
 * Every line is a verifiable statement about the real system: the feeds it
 * connects to, the algorithms it runs, the transports it uses. Plays once
 * per session, is fully skippable, and respects reduced-motion.
 */
const BOOT_LINES = [
  { text: "> GOD'S EYE KERNEL v3.3 ............. LOADED", cls: "ok" },
  { text: "> USGS SEISMIC NET ................. UPLINK ARMED", cls: "ok" },
  { text: "> NOAA SWPC + NASA EONET ........... UPLINK ARMED", cls: "ok" },
  { text: "> GDELT WORLD-NEWS INDEX ........... UPLINK ARMED", cls: "ok" },
  { text: "> ORBITAL MECHANICS (SGP4) ......... CELESTRAK TLE", cls: "ok" },
  { text: "> DIRECT-TO-BROWSER ACQUISITION .... MULTI-PATH", cls: "ok" },
  { text: "> EVERY SIGNAL CARRIES A SOURCE LINK", cls: "warn" },
];

export default function BootSequence({ onDone }) {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return false;
    try {
      return !sessionStorage.getItem("worldgpz.booted");
    } catch {
      return false;
    }
  });
  const [lines, setLines] = useState([]);
  const finished = useRef(false);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    sessionStorage.setItem("worldgpz.booted", "1");
    setVisible(false);
    onDone?.();
  }

  useEffect(() => {
    if (!visible) return undefined;
    const timers = [];
    BOOT_LINES.forEach((line, index) => {
      timers.push(
        setTimeout(
          () => setLines((current) => [...current, line]),
          220 + index * 265,
        ),
      );
    });
    timers.push(setTimeout(finish, 2950));
    const onKey = (event) => {
      if (event.key === "Escape" || event.key === " " || event.key === "Enter")
        finish();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="boot-screen" role="status" aria-label="System booting">
      <div className="boot-inner">
        <div className="boot-head">
          <div className="boot-mark" aria-hidden="true">
            <span />
          </div>
          <div className="boot-title">
            <strong>GOD&apos;S EYE</strong>
            <span>WORLDGPZ // OPEN-SOURCE SIGNAL INTELLIGENCE</span>
          </div>
        </div>
        <div className="boot-log" aria-hidden="true">
          {lines.map((line) => (
            <div key={line.text} className={line.cls}>
              {line.text}
            </div>
          ))}
          {lines.length < BOOT_LINES.length && (
            <span className="intercept-caret" />
          )}
        </div>
        <div className="boot-bar" aria-hidden="true">
          <span />
        </div>
        <button type="button" className="boot-skip" onClick={finish}>
          [ press any key to enter the grid ]
        </button>
      </div>
    </div>
  );
}
