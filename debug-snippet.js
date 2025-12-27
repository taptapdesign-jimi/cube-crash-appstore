// 🔍 INTERIM CARD DEBUG - Copy this into iPad Safari Web Inspector Console

(function() {
  const card = document.querySelector('.journey-board-card.interim');
  const wrapper = card?.closest('.journey-board-card-wrapper');
  
  if (!card || !wrapper) {
    console.error('❌ Interim card or wrapper not found');
    return;
  }
  
  // Get rects
  const cardRect = card.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();
  
  // Get computed styles
  const cardComputed = window.getComputedStyle(card);
  const wrapperComputed = window.getComputedStyle(wrapper);
  
  // Get children
  const wrapperChildren = Array.from(wrapper.children).map((child, i) => {
    const rect = child.getBoundingClientRect();
    const computed = window.getComputedStyle(child);
    return {
      index: i,
      tagName: child.tagName,
      className: child.className,
      rect: { width: rect.width, height: rect.height, left: rect.left, right: rect.right },
      computed: {
        background: computed.backgroundColor,
        boxShadow: computed.boxShadow,
        filter: computed.filter,
        position: computed.position,
        width: computed.width,
        height: computed.height
      }
    };
  });
  
  const cardChildren = Array.from(card.children).map((child, i) => {
    const rect = child.getBoundingClientRect();
    const computed = window.getComputedStyle(child);
    return {
      index: i,
      tagName: child.tagName,
      className: child.className,
      rect: { width: rect.width, height: rect.height, left: rect.left, right: rect.right },
      computed: {
        background: computed.backgroundColor,
        boxShadow: computed.boxShadow,
        filter: computed.filter,
        position: computed.position,
        width: computed.width,
        height: computed.height
      }
    };
  });
  
  // Check pseudo-elements
  const cardAfter = window.getComputedStyle(card, '::after');
  const cardBefore = window.getComputedStyle(card, '::before');
  
  // Output
  const output = {
    DOM: {
      wrapperHTML: wrapper.outerHTML.substring(0, 500) + '...',
      cardHTML: card.outerHTML.substring(0, 500) + '...'
    },
    WRAPPER: {
      rect: {
        x: wrapperRect.x,
        y: wrapperRect.y,
        width: wrapperRect.width,
        height: wrapperRect.height,
        left: wrapperRect.left,
        right: wrapperRect.right,
        top: wrapperRect.top,
        bottom: wrapperRect.bottom
      },
      computed: {
        width: wrapperComputed.width,
        height: wrapperComputed.height,
        paddingLeft: wrapperComputed.paddingLeft,
        paddingRight: wrapperComputed.paddingRight,
        background: wrapperComputed.backgroundColor,
        border: wrapperComputed.border,
        borderWidth: wrapperComputed.borderWidth,
        outline: wrapperComputed.outline,
        outlineWidth: wrapperComputed.outlineWidth,
        boxShadow: wrapperComputed.boxShadow,
        filter: wrapperComputed.filter,
        position: wrapperComputed.position,
        overflow: wrapperComputed.overflow
      },
      inlineStyle: {
        width: wrapper.style.width,
        height: wrapper.style.height,
        padding: wrapper.style.padding,
        paddingLeft: wrapper.style.paddingLeft,
        paddingRight: wrapper.style.paddingRight,
        margin: wrapper.style.margin,
        position: wrapper.style.position,
        transform: wrapper.style.transform
      }
    },
    CARD: {
      rect: {
        x: cardRect.x,
        y: cardRect.y,
        width: cardRect.width,
        height: cardRect.height,
        left: cardRect.left,
        right: cardRect.right,
        top: cardRect.top,
        bottom: cardRect.bottom
      },
      computed: {
        width: cardComputed.width,
        height: cardComputed.height,
        marginLeft: cardComputed.marginLeft,
        marginRight: cardComputed.marginRight,
        marginTop: cardComputed.marginTop,
        marginBottom: cardComputed.marginBottom,
        position: cardComputed.position,
        transform: cardComputed.transform,
        boxShadow: cardComputed.boxShadow,
        filter: cardComputed.filter,
        background: cardComputed.backgroundColor
      },
      inlineStyle: {
        width: card.style.width,
        height: card.style.height,
        margin: card.style.margin,
        marginLeft: card.style.marginLeft,
        marginRight: card.style.marginRight,
        position: card.style.position,
        transform: card.style.transform
      }
    },
    DIFFERENCE: {
      widthDiff: cardRect.width - wrapperRect.width,
      leftDiff: cardRect.left - wrapperRect.left,
      rightDiff: wrapperRect.right - cardRect.right,
      expectedLeftDiff: -9, // Should be -9px from margin-left: -9px
      expectedRightDiff: 9 // Should be 9px from padding-right: 9px
    },
    CHILDREN: {
      wrapperChildren: wrapperChildren,
      cardChildren: cardChildren
    },
    PSEUDO_ELEMENTS: {
      cardAfter: {
        content: cardAfter.content,
        display: cardAfter.display,
        position: cardAfter.position,
        width: cardAfter.width,
        height: cardAfter.height,
        background: cardAfter.backgroundColor,
        boxShadow: cardAfter.boxShadow,
        filter: cardAfter.filter
      },
      cardBefore: {
        content: cardBefore.content,
        display: cardBefore.display,
        position: cardBefore.position,
        width: cardBefore.width,
        height: cardBefore.height,
        background: cardBefore.backgroundColor,
        boxShadow: cardBefore.boxShadow,
        filter: cardBefore.filter
      }
    }
  };
  
  console.group('🔍 INTERIM CARD DEBUG DUMP');
  console.log(JSON.stringify(output, null, 2));
  console.groupEnd();
  
  // Also log formatted for easy reading
  console.group('📊 QUICK SUMMARY');
  console.log('Wrapper width:', wrapperRect.width, 'Card width:', cardRect.width);
  console.log('Left diff:', cardRect.left - wrapperRect.left, '(expected: -9px)');
  console.log('Right diff:', wrapperRect.right - cardRect.right, '(expected: 9px)');
  console.log('Wrapper padding:', wrapperComputed.paddingLeft, '/', wrapperComputed.paddingRight);
  console.log('Card margin:', cardComputed.marginLeft, '/', cardComputed.marginRight);
  console.log('Wrapper background:', wrapperComputed.backgroundColor);
  console.log('Wrapper boxShadow:', wrapperComputed.boxShadow);
  console.log('Wrapper filter:', wrapperComputed.filter);
  console.groupEnd();
  
  return output;
})();



