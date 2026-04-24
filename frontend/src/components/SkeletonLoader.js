import React from 'react';

function SkeletonLoader({ rows = 8, columns = 5 }) {
  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div style={{ ...styles.skeleton, width: '200px', height: '28px' }} />
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ ...styles.skeleton, width: '100px', height: '36px', borderRadius: '8px' }} />
          <div style={{ ...styles.skeleton, width: '100px', height: '36px', borderRadius: '8px' }} />
        </div>
      </div>
      <div className="card">
        <div style={{ ...styles.skeleton, width: '300px', height: '40px', marginBottom: '20px', borderRadius: '8px' }} />
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: '12px 16px' }}><div style={{ ...styles.skeleton, width: '20px', height: '20px', borderRadius: '4px' }} /></th>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} style={{ padding: '12px 16px' }}>
                  <div style={{ ...styles.skeleton, width: `${60 + Math.random() * 60}px`, height: '14px' }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx} style={{ borderBottom: '1px solid #2d2d4a' }}>
                <td style={{ padding: '12px 16px' }}><div style={{ ...styles.skeleton, width: '20px', height: '20px', borderRadius: '4px' }} /></td>
                {Array.from({ length: columns }).map((_, colIdx) => (
                  <td key={colIdx} style={{ padding: '12px 16px' }}>
                    <div style={{ ...styles.skeleton, width: `${40 + Math.random() * 100}px`, height: '16px', animationDelay: `${(rowIdx * columns + colIdx) * 0.05}s` }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #2d2d4a' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ ...styles.skeleton, width: '60px', height: '32px', borderRadius: '8px' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {},
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  skeleton: {
    background: 'linear-gradient(90deg, #1a1a2e 25%, #252540 50%, #1a1a2e 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s ease-in-out infinite',
    borderRadius: '6px',
    height: '16px',
  },
};

export default SkeletonLoader;
