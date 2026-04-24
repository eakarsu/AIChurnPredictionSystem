import React from 'react';

function ConfirmDialog({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel, variant }) {
  if (!isOpen) return null;

  const variantColors = {
    danger: { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', btn: '#ef4444' },
    warning: { bg: 'rgba(245, 158, 11, 0.2)', border: '#f59e0b', btn: '#f59e0b' },
    info: { bg: 'rgba(99, 102, 241, 0.2)', border: '#6366f1', btn: '#6366f1' },
  };
  const colors = variantColors[variant] || variantColors.danger;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: colors.bg, border: `2px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '24px' }}>
            {variant === 'danger' ? '!' : variant === 'warning' ? '?' : 'i'}
          </div>
          <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px' }}>{title || 'Confirm Action'}</h3>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '28px', lineHeight: '1.6' }}>{message || 'Are you sure?'}</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={onCancel}>{cancelText || 'Cancel'}</button>
            <button className="btn" style={{ background: colors.btn, color: '#fff' }} onClick={onConfirm}>{confirmText || 'Confirm'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
