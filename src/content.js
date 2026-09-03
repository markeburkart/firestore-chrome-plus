// Firestore Chrome Plus - Content Script
// Targets large JSON text blocks in the document details panel
// Supports both Firebase Console and Firestore Emulator

const MIN_TEXT_LENGTH = 150; // Collapse blocks larger than this
const OBSERVER_OPTIONS = { childList: true, subtree: true };

const ICON_COPY =
  '<svg class="json-collapser-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="9" y="9" width="12" height="12" rx="2"/>' +
  '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

const ICON_EXPAND =
  '<svg class="json-collapser-icon json-collapser-icon--expand" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>' +
  '<line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

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
      .json-collapser-copy {
        align-items: center !important;
        gap: 4px !important;
        color: #e8eaed !important;
        opacity: 0.9;
        transition: opacity 0.15s ease, color 0.15s ease !important;
      }
      .json-collapser-copy:hover {
        color: #ffffff !important;
        opacity: 1;
      }
      .json-collapser-icon {
        width: 14px;
        height: 14px;
        flex: 0 0 auto;
      }
      [data-json-collapser="node-expand"] {
        padding: 2px 4px !important;
        color: #bdc1c6 !important;
      }
      [data-json-collapser="node-expand"]:hover {
        color: #8ab4f8 !important;
      }
      .json-collapser-icon--expand {
        width: 17px;
        height: 17px;
      }
      .json-collapser-popover {
        position: fixed;
        z-index: 2147483647;
        max-width: 480px;
        min-width: 220px;
        background: #202124;
        color: #e8eaed;
        border: 1px solid #5f6368;
        border-radius: 6px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        font-family: Menlo, Monaco, monospace;
        font-size: 12px;
        display: none;
      }
      .json-collapser-popover.visible {
        display: block;
      }
      .json-collapser-popover-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 4px 8px;
        border-bottom: 1px solid #5f6368;
      }
      .json-collapser-popover-header span {
        color: #9aa0a6;
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .json-collapser-popover-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: #3c4043;
        color: #e8eaed;
        border: none;
        border-radius: 4px;
        padding: 4px 9px;
        font-size: 11px;
        font-family: inherit;
        cursor: pointer;
        white-space: nowrap;
      }
      .json-collapser-popover-btn .json-collapser-icon {
        width: 13px;
        height: 13px;
      }
      .json-collapser-popover-btn:hover {
        background: #5f6368;
      }
      .json-collapser-popover-body {
        margin: 0;
        padding: 8px;
        max-height: 320px;
        max-width: 480px;
        overflow: auto;
        white-space: pre;
        tab-size: 2;
      }
      .json-collapser-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .json-collapser-modal {
        background: #202124;
        color: #e8eaed;
        border: 1px solid #5f6368;
        border-radius: 8px;
        box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
        width: min(80vw, 900px);
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        font-family: Menlo, Monaco, monospace;
      }
      .json-collapser-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 14px;
        border-bottom: 1px solid #5f6368;
      }
      .json-collapser-modal-header strong {
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .json-collapser-modal-body {
        margin: 0;
        padding: 14px;
        overflow: auto;
        white-space: pre;
        font-size: 13px;
        tab-size: 2;
        flex: 1;
      }
    `;
    document.head.appendChild(style);
  }

  getPopover() {
    if (this._popover) return this._popover;

    const pop = document.createElement('div');
    pop.className = 'json-collapser-popover';

    const header = document.createElement('div');
    header.className = 'json-collapser-popover-header';

    const label = document.createElement('span');

    const copyBtn = document.createElement('button');
    copyBtn.className = 'json-collapser-popover-btn';
    copyBtn.innerHTML = ICON_COPY + ' Copy';

    const expandBtn = document.createElement('button');
    expandBtn.className = 'json-collapser-popover-btn';
    expandBtn.innerHTML = ICON_EXPAND + ' Expand';

    header.appendChild(label);
    const btnWrap = document.createElement('div');
    btnWrap.style.display = 'flex';
    btnWrap.style.gap = '6px';
    btnWrap.appendChild(copyBtn);
    btnWrap.appendChild(expandBtn);
    header.appendChild(btnWrap);

    const body = document.createElement('pre');
    body.className = 'json-collapser-popover-body';

    pop.appendChild(header);
    pop.appendChild(body);
    document.body.appendChild(pop);

    // Keep popover open while the pointer is inside it.
    pop.addEventListener('mouseenter', () => {
      clearTimeout(this._popoverHideTimer);
    });
    pop.addEventListener('mouseleave', () => {
      this.schedulePopoverHide();
    });

    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyToClipboard(body.textContent, copyBtn);
    });
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openModal(label.textContent, body.textContent);
      this.hidePopover();
    });

    this._popover = pop;
    this._popoverLabel = label;
    this._popoverBody = body;
    return pop;
  }

  schedulePopoverHide() {
    clearTimeout(this._popoverHideTimer);
    this._popoverHideTimer = setTimeout(() => this.hidePopover(), 250);
  }

  hidePopover() {
    if (this._popover) this._popover.classList.remove('visible');
  }

  formatForDisplay(text) {
    if (typeof text !== 'string') return text;
    const trimmed = text.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return text;
      }
    }
    return text;
  }

  showPopoverFor(anchorEl, key, getFullValue) {
    let value = getFullValue();
    if (value == null || value === '') return;
    value = this.formatForDisplay(value);

    this.getPopover();
    clearTimeout(this._popoverHideTimer);

    this._popoverLabel.textContent = key || 'value';
    this._popoverBody.textContent = value;

    const pop = this._popover;
    pop.classList.add('visible');

    // Position below the anchor, flipping / clamping to stay on screen.
    const rect = anchorEl.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let top = rect.bottom + 6;
    if (top + popRect.height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - popRect.height - 6);
    }
    let left = rect.left;
    if (left + popRect.width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - popRect.width - 8);
    }
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
  }

  attachValuePopover(anchorEl, getKey, getFullValue) {
    if (!anchorEl || anchorEl.dataset.jsonCollapserPopover) return;
    anchorEl.dataset.jsonCollapserPopover = '1';
    anchorEl.style.cursor = 'help';

    anchorEl.addEventListener('mouseenter', () => {
      this.showPopoverFor(anchorEl, getKey(), getFullValue);
    });
    anchorEl.addEventListener('mouseleave', () => {
      this.schedulePopoverHide();
    });
  }

  openModal(key, text) {
    this.closeModal();
    text = this.formatForDisplay(text);

    const backdrop = document.createElement('div');
    backdrop.className = 'json-collapser-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'json-collapser-modal';

    const header = document.createElement('div');
    header.className = 'json-collapser-modal-header';

    const title = document.createElement('strong');
    title.textContent = key || 'value';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'json-collapser-popover-btn';
    copyBtn.innerHTML = ICON_COPY + ' Copy';
    copyBtn.addEventListener('click', () => this.copyToClipboard(text, copyBtn));

    const closeBtn = document.createElement('button');
    closeBtn.className = 'json-collapser-popover-btn';
    closeBtn.textContent = '✕ Close';
    closeBtn.addEventListener('click', () => this.closeModal());

    actions.appendChild(copyBtn);
    actions.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(actions);

    const body = document.createElement('pre');
    body.className = 'json-collapser-modal-body';
    body.textContent = text;

    modal.appendChild(header);
    modal.appendChild(body);
    backdrop.appendChild(modal);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.closeModal();
    });
    this._modalKeyHandler = (e) => {
      if (e.key === 'Escape') this.closeModal();
    };
    document.addEventListener('keydown', this._modalKeyHandler);

    document.body.appendChild(backdrop);
    this._modal = backdrop;
  }

  closeModal() {
    if (this._modal) {
      this._modal.remove();
      this._modal = null;
    }
    if (this._modalKeyHandler) {
      document.removeEventListener('keydown', this._modalKeyHandler);
      this._modalKeyHandler = null;
    }
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
    btn.innerHTML = ICON_COPY + ' Copy';
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
    expandBtn.innerHTML = ICON_EXPAND;
    expandBtn.title = 'Open full value in a popup';
    expandBtn.style.display = 'none'; // Hidden by default

    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const result = this.extractNodeValue(node);
      const text = this.buildJSONFromNode(node);
      if (text) {
        this.hidePopover();
        this.openModal(result ? result.key : '', text);
      }
    });

    // Hover popover on the collapsed value text itself
    const leafValue = node.querySelector('.database-leaf-value');
    this.attachValuePopover(
      leafValue,
      () => {
        const r = this.extractNodeValue(node);
        return r ? r.key : '';
      },
      () => this.buildJSONFromNode(node)
    );

    // Insert buttons as last children of key-value container
    keyValueContainer.appendChild(expandBtn);
    keyValueContainer.appendChild(btn);

    // Show/hide buttons on hover
    keyValueContainer.addEventListener('mouseenter', () => {
      btn.style.display = 'inline-flex';
      expandBtn.style.display = 'inline-flex';
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
    btn.innerHTML = ICON_COPY + ' Copy All';
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
      btn.style.display = 'inline-flex';
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
    btn.innerHTML = ICON_COPY + ' Copy';
    btn.title = 'Copy JSON to clipboard';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyToClipboard(text, btn);
    });

    return btn;
  }

  copyToClipboard(text, btn) {
    const original = btn.innerHTML;

    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = '✓ Copied!';
      setTimeout(() => {
        btn.innerHTML = original;
      }, 2000);
    }).catch(() => {
      btn.textContent = '✗ Failed';
      setTimeout(() => {
        btn.innerHTML = original;
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
    btn.innerHTML = ICON_COPY + ' Copy';
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
    expandBtn.innerHTML = ICON_EXPAND;
    expandBtn.title = 'Open full value in a popup';
    expandBtn.style.display = 'none';

    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const result = this.extractEmulatorFieldValue(field);
      const text = this.buildJSONFromEmulatorField(field);
      if (text) {
        this.hidePopover();
        this.openModal(result ? result.key : '', text);
      }
    });

    // Hover popover on the collapsed value text itself
    const summary = field.querySelector('.FieldPreview-summary');
    this.attachValuePopover(
      summary,
      () => {
        const r = this.extractEmulatorFieldValue(field);
        return r ? r.key : '';
      },
      () => this.buildJSONFromEmulatorField(field)
    );

    keyElement.parentElement.appendChild(expandBtn);
    keyElement.parentElement.appendChild(btn);

    keyElement.parentElement.addEventListener('mouseenter', () => {
      btn.style.display = 'inline-flex';
      expandBtn.style.display = 'inline-flex';
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
    btn.innerHTML = ICON_COPY + ' Copy All';
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
      btn.style.display = 'inline-flex';
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
