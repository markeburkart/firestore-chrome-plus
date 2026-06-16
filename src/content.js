// Firebase JSON Collapser - Content Script
// Targets large JSON text blocks in the document details panel
// Supports both Firebase Console and Firestore Emulator

const MIN_TEXT_LENGTH = 150; // Collapse blocks larger than this
const OBSERVER_OPTIONS = { childList: true, subtree: true };

class JSONCollapser {
  constructor() {
    this.processedElements = new WeakSet();
    this.environment = this.detectEnvironment();
    this.init();
  }

  detectEnvironment() {
    // Check if we're on the Firestore emulator
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (window.location.pathname.includes('firestore')) {
        return 'emulator';
      }
    }
    return 'firebase-console';
  }

  init() {
    // Inject styles for truncating long values
    this.injectStyles();

    // Wait for Firebase UI to be ready
    setTimeout(() => {
      this.processJSONBlocks();
      this.addDocumentCopyButton();
    }, 500);

    // Watch for changes in the document details panel
    const observer = new MutationObserver(() => {
      this.processJSONBlocks();
      this.addDocumentCopyButton();
    });

    observer.observe(document.body, OBSERVER_OPTIONS);
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .database-leaf-value {
        max-width: 100px !important;
        display: inline-block !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        vertical-align: middle !important;
      }
      .database-leaf-value.expanded {
        max-width: 200px !important;
      }
      .FieldPreview-summary {
        max-width: 100px !important;
        display: inline-block !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        vertical-align: middle !important;
      }
      .FieldPreview-summary.expanded {
        max-width: 200px !important;
      }
    `;
    document.head.appendChild(style);
  }

  processJSONBlocks() {
    if (this.environment === 'emulator') {
      this.processEmulatorFields();
    } else {
      this.processFirebaseConsoleFields();
    }
  }

  processFirebaseConsoleFields() {
    const dbNodes = document.querySelectorAll('.database-node');
    let isFirst = true;

    dbNodes.forEach(node => {
      this.addCopyButtonToNode(node);
      if (isFirst) {
        this.addCopyAllButton(node);
        isFirst = false;
      }
    });
  }

  processEmulatorFields() {
    const fieldPreviews = document.querySelectorAll('.FieldPreview');
    let isFirst = true;

    fieldPreviews.forEach(field => {
      const key = field.querySelector('.FieldPreview-key');
      if (key && !this.processedElements.has(field)) {
        this.addCopyButtonToEmulatorField(field);
        if (isFirst && this.isTopLevelField(field)) {
          this.addCopyAllButtonToEmulator(field);
          isFirst = false;
        }
      }
    });
  }

  isTopLevelField(field) {
    let current = field.parentElement;
    while (current && current !== document.body) {
      if (current.classList.contains('FieldPreview-children')) {
        current = current.parentElement.parentElement;
      }
      if (current && current.classList.contains('FieldPreview')) {
        return false;
      }
      current = current.parentElement;
    }
    return true;
  }

  addCopyButtonToNode(node) {
    // Skip if already has a copy button
    if (node.querySelector('[data-json-collapser="node-copy"]')) {
      return;
    }

    const keyValueContainer = node.querySelector('.database-key-value');
    if (!keyValueContainer) return;

    const btn = document.createElement('button');
    btn.className = 'json-collapser-copy';
    btn.setAttribute('data-json-collapser', 'node-copy');
    btn.textContent = '📋 Copy';
    btn.title = 'Copy value to clipboard';
    btn.style.display = 'none'; // Hidden by default

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const json = this.buildJSONFromNode(node);
      if (json) {
        this.copyToClipboard(json, btn);
      }
    });

    const expandBtn = document.createElement('button');
    expandBtn.className = 'json-collapser-copy';
    expandBtn.setAttribute('data-json-collapser', 'node-expand');
    expandBtn.textContent = '▶';
    expandBtn.title = 'Expand field width';
    expandBtn.style.display = 'none'; // Hidden by default
    expandBtn.style.fontSize = '12px';

    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const leafValue = node.querySelector('.database-leaf-value');
      if (leafValue) {
        leafValue.classList.toggle('expanded');
        expandBtn.textContent = leafValue.classList.contains('expanded') ? '◀' : '▶';
      }
    });

    // Insert buttons as last children of key-value container
    keyValueContainer.appendChild(expandBtn);
    keyValueContainer.appendChild(btn);

    // Show/hide buttons on hover
    keyValueContainer.addEventListener('mouseenter', () => {
      btn.style.display = 'inline-block';
      expandBtn.style.display = 'inline-block';
    });

    keyValueContainer.addEventListener('mouseleave', () => {
      btn.style.display = 'none';
      expandBtn.style.display = 'none';
    });
  }

  addCopyAllButton(node) {
    // Skip if already has a copy-all button
    if (node.querySelector('[data-json-collapser="copy-all"]')) {
      return;
    }

    const keyValueContainer = node.querySelector('.database-key-value');
    if (!keyValueContainer) return;

    const btn = document.createElement('button');
    btn.className = 'json-collapser-copy';
    btn.setAttribute('data-json-collapser', 'copy-all');
    btn.textContent = '📋 Copy All';
    btn.title = 'Copy entire document as JSON';
    btn.style.display = 'none'; // Hidden by default

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const json = this.buildFullDocumentJSON();
      if (json) {
        this.copyToClipboard(json, btn);
      }
    });

    // Insert button as last child of key-value container
    keyValueContainer.appendChild(btn);

    // Show/hide button on hover
    keyValueContainer.addEventListener('mouseenter', () => {
      btn.style.display = 'inline-block';
    });

    keyValueContainer.addEventListener('mouseleave', () => {
      btn.style.display = 'none';
    });
  }

  buildJSONFromNode(node) {
    const result = this.extractNodeValue(node);
    if (!result) return null;
    // Return string values as-is without quotes, otherwise return JSON
    if (typeof result.value === 'string') {
      return result.value;
    }
    return JSON.stringify(result.value, null, 2);
  }

  buildFullDocumentJSON() {
    const allNodes = document.querySelectorAll('.database-node:not(.is-within-array)');
    const topLevelNodes = Array.from(allNodes).filter(node => {
      // Check if this node has a .database-node ancestor (meaning it's nested)
      let current = node.parentElement;
      while (current && current !== document.body) {
        if (current.classList.contains('database-node')) {
          return false; // Has a .database-node ancestor, so it's not top-level
        }
        current = current.parentElement;
      }
      return true; // No .database-node ancestor, so it's top-level
    });

    const obj = {};

    topLevelNodes.forEach(node => {
      const result = this.extractNodeValue(node);
      if (result && result.key) {
        obj[result.key] = result.value;
      }
    });

    return Object.keys(obj).length > 0 ? JSON.stringify(obj, null, 2) : null;
  }

  async constructDocumentJSON() {
    const allNodes = document.querySelectorAll('.database-node:not(.is-within-array)');
    const topLevelNodes = Array.from(allNodes).filter(node => {
      // Check if this node has a .database-node ancestor (meaning it's nested)
      let current = node.parentElement;
      while (current && current !== document.body) {
        if (current.classList.contains('database-node')) {
          return false; // Has a .database-node ancestor, so it's not top-level
        }
        current = current.parentElement;
      }
      return true; // No .database-node ancestor, so it's top-level
    });

    const obj = {};

    for (const node of topLevelNodes) {
      const result = this.extractNodeValue(node);
      if (result && result.key) {
        obj[result.key] = result.value;
      }
    }

    return Object.keys(obj).length > 0 ? JSON.stringify(obj, null, 2) : null;
  }

  extractNodeValue(node) {
    const keyValueContainer = node.querySelector('.database-key-value');
    if (!keyValueContainer) return null;

    const keyEl = keyValueContainer.querySelector('.database-key');
    if (!keyEl) return null;

    const key = keyEl.textContent.trim();
    const childrenContainer = node.querySelector(':scope > .database-children');

    // If has children container, build array or object (even if empty)
    if (childrenContainer) {
      const childNodes = childrenContainer.querySelectorAll(':scope > f7e-data-tree > .database-node');
      const isArray = node.classList.contains('type-array');
      let value;

      if (isArray) {
        value = [];
        childNodes.forEach(child => {
          const childResult = this.extractNodeValue(child);
          if (childResult) {
            value.push(childResult.value);
          }
        });
      } else {
        // Object/map - use key-value pairs
        value = {};
        childNodes.forEach(child => {
          const childResult = this.extractNodeValue(child);
          if (childResult && childResult.key) {
            value[childResult.key] = childResult.value;
          }
        });
      }

      return { key, value };
    }

    // Otherwise get leaf value
    const leafValue = keyValueContainer.querySelector('.database-leaf-value');
    if (!leafValue) return { key, value: null };

    let valueText = leafValue.textContent.trim();

    try {
      return { key, value: JSON.parse(valueText) };
    } catch {
      return { key, value: valueText };
    }
  }

  collapseAndWait(button, wrapper) {
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        if (wrapper.getAttribute('aria-expanded') === 'false') {
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(wrapper, { attributes: true, attributeFilter: ['aria-expanded'] });

      // Try multiple click methods for Material Design compatibility
      button.click();
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      // Timeout fallback in case observer doesn't catch it
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 300);
    });
  }

  expandAndWait(button, wrapper) {
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        if (wrapper.getAttribute('aria-expanded') === 'true') {
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(wrapper, { attributes: true, attributeFilter: ['aria-expanded'] });

      // Try multiple click methods for Material Design compatibility
      button.click();
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      // Timeout fallback in case observer doesn't catch it
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 300);
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

    const hasExistingButton = el.previousElementSibling?.getAttribute('data-json-collapser') === 'copy';

    // Create copy button if it doesn't exist
    if (!hasExistingButton) {
      this.processedElements.add(el);
      const copyBtn = this.createCopyButton(el.textContent);
      el.parentNode.insertBefore(copyBtn, el);
    }

    // Always hide original content
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
    const originalText = btn.textContent;

    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = '✓ Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    }).catch(() => {
      btn.textContent = '✗ Failed';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    });
  }

  addCopyButtonToEmulatorField(field) {
    if (field.querySelector('[data-json-collapser="node-copy"]')) {
      return;
    }

    this.processedElements.add(field);
    const keyElement = field.querySelector('.FieldPreview-key');
    if (!keyElement) return;

    const btn = document.createElement('button');
    btn.className = 'json-collapser-copy';
    btn.setAttribute('data-json-collapser', 'node-copy');
    btn.textContent = '📋 Copy';
    btn.title = 'Copy value to clipboard';
    btn.style.display = 'none';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const json = this.buildJSONFromEmulatorField(field);
      if (json) {
        this.copyToClipboard(json, btn);
      }
    });

    const expandBtn = document.createElement('button');
    expandBtn.className = 'json-collapser-copy';
    expandBtn.setAttribute('data-json-collapser', 'node-expand');
    expandBtn.textContent = '▶';
    expandBtn.title = 'Expand field width';
    expandBtn.style.display = 'none';
    expandBtn.style.fontSize = '12px';

    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const summary = field.querySelector('.FieldPreview-summary');
      if (summary) {
        summary.classList.toggle('expanded');
        expandBtn.textContent = summary.classList.contains('expanded') ? '◀' : '▶';
      }
    });

    keyElement.parentElement.appendChild(expandBtn);
    keyElement.parentElement.appendChild(btn);

    keyElement.parentElement.addEventListener('mouseenter', () => {
      btn.style.display = 'inline-block';
      expandBtn.style.display = 'inline-block';
    });

    keyElement.parentElement.addEventListener('mouseleave', () => {
      btn.style.display = 'none';
      expandBtn.style.display = 'none';
    });
  }

  addCopyAllButtonToEmulator(field) {
    if (field.querySelector('[data-json-collapser="copy-all"]')) {
      return;
    }

    const keyElement = field.querySelector('.FieldPreview-key');
    if (!keyElement) return;

    const btn = document.createElement('button');
    btn.className = 'json-collapser-copy';
    btn.setAttribute('data-json-collapser', 'copy-all');
    btn.textContent = '📋 Copy All';
    btn.title = 'Copy entire document as JSON';
    btn.style.display = 'none';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const json = this.buildFullDocumentJSONFromEmulator();
      if (json) {
        this.copyToClipboard(json, btn);
      }
    });

    keyElement.parentElement.appendChild(btn);

    keyElement.parentElement.addEventListener('mouseenter', () => {
      btn.style.display = 'inline-block';
    });

    keyElement.parentElement.addEventListener('mouseleave', () => {
      btn.style.display = 'none';
    });
  }

  buildJSONFromEmulatorField(field) {
    const result = this.extractEmulatorFieldValue(field);
    if (!result) return null;
    if (typeof result.value === 'string') {
      return result.value;
    }
    return JSON.stringify(result.value, null, 2);
  }

  buildFullDocumentJSONFromEmulator() {
    const fieldList = document.querySelector('.Firestore-Field-List');
    if (!fieldList) return null;

    const topLevelFields = Array.from(fieldList.querySelectorAll(':scope > .FieldPreview'));
    const obj = {};

    topLevelFields.forEach(field => {
      const result = this.extractEmulatorFieldValue(field);
      if (result && result.key) {
        obj[result.key] = result.value;
      }
    });

    return Object.keys(obj).length > 0 ? JSON.stringify(obj, null, 2) : null;
  }

  extractEmulatorFieldValue(field) {
    const keyElement = field.querySelector('.FieldPreview-key');
    if (!keyElement) return null;

    const key = keyElement.textContent.trim();
    const typeElement = field.querySelector('.FieldPreview-type');
    const type = typeElement ? typeElement.textContent.trim() : '';
    const childrenContainer = field.querySelector('.FieldPreview-children');

    if (childrenContainer) {
      const isArray = type.includes('array');
      let value;

      if (isArray) {
        value = [];
        const childFields = childrenContainer.querySelectorAll(':scope > .FieldPreview');
        childFields.forEach(childField => {
          const childResult = this.extractEmulatorFieldValue(childField);
          if (childResult) {
            value.push(childResult.value);
          }
        });
      } else {
        value = {};
        const childFields = childrenContainer.querySelectorAll(':scope > .FieldPreview');
        childFields.forEach(childField => {
          const childResult = this.extractEmulatorFieldValue(childField);
          if (childResult && childResult.key) {
            value[childResult.key] = childResult.value;
          }
        });
      }

      return { key, value };
    }

    const summaryElement = field.querySelector('.FieldPreview-summary');
    if (!summaryElement) return { key, value: null };

    let valueText = summaryElement.textContent.trim();

    // Handle special types
    if (type.includes('boolean')) {
      return { key, value: valueText === 'true' };
    }
    if (type.includes('number')) {
      const num = parseFloat(valueText);
      return { key, value: isNaN(num) ? valueText : num };
    }
    if (type.includes('timestamp')) {
      return { key, value: valueText };
    }

    // Handle quoted strings and other values
    try {
      return { key, value: JSON.parse(valueText) };
    } catch {
      return { key, value: valueText };
    }
  }

  addDocumentCopyButton() {
    // Placeholder - to be implemented
  }

  extractDocumentJSON() {
    // Find the document details container and look for the largest text block
    // (which should be the full document JSON)
    let largestElement = null;
    let largestSize = 0;

    const container = document.querySelector('[role="tabpanel"]') ||
                     document.querySelector('.firestore-document') ||
                     document.body;

    const allElements = container.querySelectorAll('div, span');

    allElements.forEach(el => {
      const text = el.textContent;
      if (text && text.length > largestSize && this.looksLikeJSON(text)) {
        largestSize = text.length;
        largestElement = el;
      }
    });

    return largestElement ? largestElement.textContent : null;
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
