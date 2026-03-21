import React from 'react';

const LoadingSkeleton: React.FC = () => (
  <div className="loading-skeleton">
    <div className="skeleton-line" style={{ width: '80%' }} />
    <div className="skeleton-line" style={{ width: '60%' }} />
    <div className="skeleton-line" style={{ width: '90%' }} />
  </div>
);

export default LoadingSkeleton;