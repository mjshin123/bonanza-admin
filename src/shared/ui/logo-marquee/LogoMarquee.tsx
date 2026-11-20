import { useEffect, useRef, useState } from "react";

import "./LogoMarquee.css";

export type LogoMarqueeItem = {
  id: string | number;
  name: string;
  logo: string;
  siteHref?: string;
};

type LogoMarqueeProps = {
  items: LogoMarqueeItem[];
  speed?: number;
  logoHeight?: number;
  gap?: number;
  ariaLabel?: string;
};

export function LogoMarquee({ items, speed = 60, logoHeight = 40, gap = 56, ariaLabel }: LogoMarqueeProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [duration, setDuration] = useState(30);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      const setWidth = track.scrollWidth / 2;
      setDuration(setWidth / speed);
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [speed, items]);

  const renderLogo = (item: LogoMarqueeItem, key: string) => {
    const image = <img src={item.logo} alt={item.name} title={item.name} style={{ height: logoHeight, width: "auto", maxWidth: 160, objectFit: "contain" }} />;
    return (
      <li key={key} className="bonanza-logo-marquee__item">
        {item.siteHref ? (
          <a href={item.siteHref} target="_blank" rel="noopener noreferrer" aria-label={item.name}>
            {image}
          </a>
        ) : (
          image
        )}
      </li>
    );
  };

  return (
    <div
      className="bonanza-logo-marquee"
      role="group"
      aria-label={ariaLabel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <ul
        ref={trackRef}
        className="bonanza-logo-marquee__track"
        style={{
          gap,
          animationDuration: `${duration}s`,
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {items.map((item) => renderLogo(item, `a-${item.id}`))}
        {items.map((item) => renderLogo(item, `b-${item.id}`))}
      </ul>
    </div>
  );
}
