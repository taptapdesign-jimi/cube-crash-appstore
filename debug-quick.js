// 🔍 QUICK DEBUG - Copy into iPad Safari Console
// This will output the exact numbers needed to fix the offset

(function() {
  const card = document.querySelector('.journey-board-card.interim');
  const wrapper = card?.closest('.journey-board-card-wrapper');
  
  if (!card || !wrapper) {
    console.error('❌ Interim card not found');
    return;
  }
  
  const cardRect = card.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();
  
  // Get inline styles (what JS set)
  const cardWidth = parseFloat(card.style.width) || 0;
  const wrapperWidth = parseFloat(wrapper.style.width) || 0;
  
  // Calculate what offset was used
  const actualCardWidth = cardWidth || cardRect.width;
  const actualWrapperWidth = wrapperWidth || wrapperRect.width;
  const usedOffset = (actualCardWidth - actualWrapperWidth) / 2;
  
  console.group('📊 EXACT MEASUREMENTS');
  console.log('actualCardWidth:', actualCardWidth);
  console.log('wrapperWidth:', actualWrapperWidth);
  console.log('wrapperHorizontalOffset (calculated):', usedOffset);
  console.log('cardRect.width:', cardRect.width);
  console.log('wrapperRect.width:', wrapperRect.width);
  console.log('left diff:', cardRect.left - wrapperRect.left);
  console.log('right diff:', wrapperRect.right - cardRect.right);
  console.groupEnd();
  
  // Check shimmer layer
  const cardAfter = window.getComputedStyle(card, '::after');
  console.group('✨ SHIMMER LAYER');
  console.log('::after content:', cardAfter.content);
  console.log('::after display:', cardAfter.display);
  console.log('::after width:', cardAfter.width);
  console.log('::after height:', cardAfter.height);
  console.log('::after border-radius:', cardAfter.borderRadius);
  console.log('::after background:', cardAfter.backgroundColor);
  console.groupEnd();
  
  return {
    actualCardWidth,
    wrapperWidth: actualWrapperWidth,
    wrapperHorizontalOffset: usedOffset,
    cardRect: { width: cardRect.width, left: cardRect.left, right: cardRect.right },
    wrapperRect: { width: wrapperRect.width, left: wrapperRect.left, right: wrapperRect.right }
  };
})();




