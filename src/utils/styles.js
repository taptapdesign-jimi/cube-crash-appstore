// CSS styles for modals and elements
export const MODAL_STYLES = {
  OVERLAY: {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    background: 'rgba(245, 245, 245, 0.8)',
    backdropFilter: 'blur(14px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '1000000',
    fontFamily: '"LTCrow", Arial, sans-serif',
    transition: 'opacity 0.5s ease-out, backdrop-filter 0.5s ease-out'
  },
  MODAL: {
    position: 'fixed',
    bottom: '0',
    left: '0',
    right: '0',
    background: 'white',
    borderRadius: '20px 20px 0 0',
    padding: '20px',
    transform: 'translateY(100%)',
    transition: 'transform 0.3s ease-out',
    zIndex: '1000001'
  },
  BUTTON: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  PRIMARY_BUTTON: {
    background: '#FF6B35',
    color: 'white'
  },
  SECONDARY_BUTTON: {
    background: 'white',
    color: '#8B4513',
    border: '2px solid #8B4513'
  }
};

// Apply styles to element
export const applyStyles = (element, styles) => {
  if (!element) return;
  
  try {
    Object.assign(element.style, styles);
  } catch (error) {
    console.error('Failed to apply styles:', error);
  }
};

// Create modal element with styles
export const createModalElement = (className, styles = {}) => {
  const element = document.createElement('div');
  element.className = className;
  applyStyles(element, styles);
  return element;
};
