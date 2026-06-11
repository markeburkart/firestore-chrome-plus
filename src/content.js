// Firebase JSON Collapser - Content Script
// Targets large JSON text blocks in the document details panel

const MIN_TEXT_LENGTH = 150; // Collapse blocks larger than this
const OBSERVER_OPTIONS = { childList: true, subtree: true };

class JSONCollapser {
  constructor() {
    this.processedElements = new WeakSet();
    this.init();
  }

  init() {
    // Wait for Firebase UI to be ready
    setTimeout(() => this.processJSONBlocks(), 500);

    // Watch for changes in the document details panel
    const observer = new MutationObserver(() => {
      this.processJSONBlocks();
    });

    observer.observe(document.body, OBSERVER_OPTIONS);
  }

  processJSONBlocks() {
    // Look for text nodes with large JSON-like content in the right panel
    // Firebase displays field values in divs/spans with monospace text
    const allElements = document.querySelectorAll('div, span');

    allElements.forEach(el => {
      // Skip if too small
      if (!el.textContent || el.textContent.length < MIN_TEXT_LENGTH) {
        return;
      }

      // Skip if already processed
      if (this.processedElements.has(el)) {
        return;
      }

      // Look for elements that contain JSON-like structures
      const text = el.textContent;
      if (this.looksLikeJSON(text) && this.isInDocumentPanel(el)) {
        this.enhanceElement(el);
      }
    });
  }

  looksLikeJSON(text) {
    // Check if text looks like JSON (contains objects/arrays)
    return (text.includes('{') && text.includes('}')) ||
           (text.includes('[') && text.includes(']'));
  }

  isInDocumentPanel(el) {
    // Check if element is in the right document details panel
    // Look for parent elements with specific Firebase styles
    let current = el;
    for (let i = 0; i < 10; i++) {
      if (!current) return false;

      const style = window.getComputedStyle(current);
      // Firebase document panels typically have monospace font
      if (style.fontFamily && style.fontFamily.includes('Courier') ||
          style.fontFamily.includes('Menlo') ||
          style.fontFamily.includes('monospace')) {
        return true;
      }

      // Also check for elements that contain field value displays
      if (current.textContent &&
          current.className &&
          (current.className.includes('value') ||
           current.className.includes('content') ||
           current.getAttribute('data-field'))) {
        return true;
      }

      current = current.parentElement;
    }
    return false;
  }

  enhanceElement(el) {
    // Only enhance direct text content, not nested structures
    if (el.children.length > 0) {
      return;
    }

    this.processedElements.add(el);

    const copyBtn = this.createCopyButton(el.textContent);

    // Insert button before the element
    el.parentNode.insertBefore(copyBtn, el);

    // Hide original content by default
    el.style.display = 'none';
  }

  createCopyButton(text) {
    const btn = document.createElement('button');
    btn.className = 'json-collapser-copy';
    btn.setAttribute('data-json-collapser', 'copy');
    btn.textContent = '📋 Copy';
    btn.title = 'Copy JSON to clipboard';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyToClipboard(text, btn);
    });

    return btn;
  }

  copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      // Show feedback
      const originalText = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    }).catch(() => {
      btn.textContent = '✗ Failed';
      setTimeout(() => {
        btn.textContent = '📋 Copy';
      }, 2000);
    });
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new JSONCollapser();
  });
} else {
  new JSONCollapser();
}
