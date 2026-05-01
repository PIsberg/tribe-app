import { useEffect } from "react";

const PUB_ID = import.meta.env.VITE_ADSENSE_PUB_ID ?? "ca-pub-XXXXXXXXXXXXXXXX";
const IS_REAL_PUB = !PUB_ID.includes("XXXX");
const ADSENSE_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUB_ID}`;

export function AdSenseProvider() {
  useEffect(() => {
    if (!IS_REAL_PUB) return;
    if (document.querySelector(`script[src^="https://pagead2"]`)) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = ADSENSE_SRC;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return null;
}
