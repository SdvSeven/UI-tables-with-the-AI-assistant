import { useState, useRef, useEffect } from 'react';

export const useVirtualScroll = (itemCount: number, itemHeight: number, containerHeight: number) => {
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(Math.ceil(containerHeight / itemHeight));
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    const scrollTop = target.scrollTop;
    const newStart = Math.floor(scrollTop / itemHeight);
    setStartIndex(newStart);
    setEndIndex(newStart + Math.ceil(containerHeight / itemHeight));
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [containerHeight, itemHeight]);

  return {
    containerRef,
    startIndex,
    endIndex,
    totalHeight: itemCount * itemHeight,
    offsetY: startIndex * itemHeight,
    visibleItems: Math.min(endIndex - startIndex, itemCount - startIndex),
  };
};