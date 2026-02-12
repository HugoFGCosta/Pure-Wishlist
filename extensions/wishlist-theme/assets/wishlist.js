/**
 * Pure Wishlist — Theme Extension JS
 * Handles wishlist button toggling, wishlist page rendering,
 * and auto-injected heart overlays on product card images.
 */

(function () {
  'use strict';

  const PROXY = '/apps/wishlist';

  /** SVG heart markup shared by overlays */
  const HEART_SVG =
    '<svg class="pw-heart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">' +
    '<path class="pw-heart__outline" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 ' +
    '2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09 ' +
    'C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5 ' +
    'c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path class="pw-heart__filled" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 ' +
    '2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09 ' +
    'C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5 ' +
    'c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" stroke="none"/>' +
    '</svg>';

  const PureWishlist = {
    /** Track initialised state to avoid double-init */
    _ready: false,

    /** Overlay-specific state */
    _overlayCustomerId: null,
    _overlayColor: null,
    _processedLinks: new WeakSet(),

    /**
     * Entry point. Discovers buttons and the page grid, then hydrates state.
     */
    init() {
      if (this._ready) return;
      this._ready = true;

      this.buttons = document.querySelectorAll('[data-pw-button]');
      this.page = document.querySelector('[data-pw-page]');

      const hasCustomer = this._hasCustomer();

      if (this.buttons.length && hasCustomer) {
        this._checkButtons();
        this._bindButtons();
      }

      if (this.page && hasCustomer) {
        this.loadWishlistPage();
      }

      // Auto-overlay system (from embed block)
      this._initOverlays();
    },

    /* ------------------------------------------------------------------ */
    /*  Buttons                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * Batch-check which products are already wishlisted.
     * GET /apps/wishlist?action=check&products=1,2,3
     */
    _checkButtons() {
      const ids = [];
      this.buttons.forEach((wrap) => {
        const pid = wrap.dataset.productId;
        if (pid) ids.push(pid);
      });
      if (!ids.length) return;

      fetch(`${PROXY}?action=check&products=${ids.join(',')}`, {
        credentials: 'same-origin',
      })
        .then((r) => r.json())
        .then((data) => {
          const set = new Set((data.wishlisted || []).map(String));
          this.buttons.forEach((wrap) => {
            if (set.has(String(wrap.dataset.productId))) {
              this._setActive(wrap, true);
            }
          });
        })
        .catch((err) => console.error('[PureWishlist] check failed', err));
    },

    /**
     * Bind click handlers on every button.
     */
    _bindButtons() {
      this.buttons.forEach((wrap) => {
        const btn = wrap.querySelector('.pw-btn');
        if (!btn) return;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const pid = wrap.dataset.productId;
          if (pid) this.toggle(pid, wrap);
        });
      });
    },

    /**
     * Toggle a product in the wishlist.
     * POST /apps/wishlist  body: { productId }
     */
    toggle(productId, wrapEl) {
      const isActive = wrapEl.classList.contains('pw-btn--active');

      // Optimistic UI
      this._setActive(wrapEl, !isActive);

      fetch(PROXY, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: String(productId) }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(r.statusText);
          return r.json();
        })
        .then((data) => {
          this._setActive(wrapEl, !!data.wishlisted);
          // Sync all overlays for the same product
          this._syncOverlays(String(productId), !!data.wishlisted);
        })
        .catch((err) => {
          console.error('[PureWishlist] toggle failed', err);
          this._setActive(wrapEl, isActive);
        });
    },

    /**
     * Set active/inactive visual state on a button wrapper.
     */
    _setActive(wrapEl, active) {
      const btn = wrapEl.querySelector('.pw-btn');
      const textEl = wrapEl.querySelector('.pw-btn__text');

      if (active) {
        wrapEl.classList.add('pw-btn--active');
      } else {
        wrapEl.classList.remove('pw-btn--active');
      }

      if (textEl) {
        textEl.textContent = active
          ? textEl.dataset.pwTextRemove
          : textEl.dataset.pwTextAdd;
      }

      if (btn) {
        btn.setAttribute(
          'aria-label',
          active
            ? (textEl && textEl.dataset.pwTextRemove) || 'Remove from Wishlist'
            : (textEl && textEl.dataset.pwTextAdd) || 'Add to Wishlist'
        );
      }
    },

    /* ------------------------------------------------------------------ */
    /*  Wishlist Page                                                      */
    /* ------------------------------------------------------------------ */

    /**
     * Fetch and render the full wishlist on the dedicated page.
     * GET /apps/wishlist?action=list
     */
    loadWishlistPage() {
      const grid = document.querySelector('[data-pw-grid]');
      const empty = document.querySelector('[data-pw-empty]');
      const loading = document.querySelector('[data-pw-loading]');

      if (!grid) return;

      fetch(`${PROXY}?action=list`, { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((data) => {
          if (loading) loading.style.display = 'none';

          const items = data.products || [];
          if (!items.length) {
            if (empty) empty.style.display = '';
            return;
          }

          grid.style.display = '';
          items.forEach((product) => this._renderCard(grid, product));
        })
        .catch((err) => {
          console.error('[PureWishlist] loadPage failed', err);
          if (loading) loading.style.display = 'none';
          if (empty) empty.style.display = '';
        });
    },

    /**
     * Clone the card template and fill it with product data.
     */
    _renderCard(grid, product) {
      const tpl = document.querySelector('[data-pw-card-template]');
      if (!tpl) return;

      const clone = tpl.content.cloneNode(true);
      const card = clone.querySelector('.pw-card');

      const imgLink = card.querySelector('.pw-card__image-link');
      const img = card.querySelector('.pw-card__image');
      const title = card.querySelector('.pw-card__title');
      const price = card.querySelector('.pw-card__price');
      const atc = card.querySelector('.pw-card__atc');
      const remove = card.querySelector('.pw-card__remove');

      if (imgLink) imgLink.href = product.url || '#';
      if (img) {
        img.src = product.image || '';
        img.alt = product.title || '';
      }
      if (title) {
        title.href = product.url || '#';
        title.textContent = product.title || '';
      }
      if (price) price.textContent = product.price || '';

      if (atc) {
        atc.addEventListener('click', () => {
          const variantId = product.variant_id;
          if (!variantId) return;
          fetch('/cart/add.js', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] }),
          })
            .then((r) => {
              if (r.ok) atc.textContent = 'Added!';
            })
            .catch(() => {});
        });
      }

      if (remove) {
        remove.addEventListener('click', () => {
          this.toggle(product.id, { classList: { contains: () => true, add() {}, remove() {} } });
          card.remove();
          if (!grid.children.length) {
            const emptyEl = document.querySelector('[data-pw-empty]');
            if (emptyEl) emptyEl.style.display = '';
          }
        });
      }

      grid.appendChild(clone);
    },

    /* ------------------------------------------------------------------ */
    /*  Heart Overlay System                                              */
    /* ------------------------------------------------------------------ */

    /**
     * Entry point for the auto-overlay system.
     * Reads config from embed script data attrs, fetches backend color, scans DOM.
     */
    _initOverlays() {
      const embedScript = document.querySelector('script[data-pw-embed]');
      if (!embedScript) return;

      this._overlayCustomerId = embedScript.dataset.pwCustomerId || null;
      this._overlayColor = embedScript.dataset.pwColor || '#ff0000';

      // Set fallback color immediately
      document.documentElement.style.setProperty('--pw-overlay-color', this._overlayColor);

      // Try to fetch backend settings for authoritative color
      fetch(`${PROXY}?action=settings`, { credentials: 'same-origin' })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data && data.settings && data.settings.button_color) {
            this._overlayColor = data.settings.button_color;
            document.documentElement.style.setProperty('--pw-overlay-color', this._overlayColor);
          }
        })
        .catch(() => {})
        .finally(() => {
          this._scanAndInject();
          this._observeDOM();
        });
    },

    /**
     * Scan DOM for product links with images, extract handles, resolve to IDs, inject hearts.
     */
    _scanAndInject() {
      const links = document.querySelectorAll('a[href*="/products/"]');
      const toResolve = new Map(); // handle → [link, ...]

      links.forEach((link) => {
        if (this._processedLinks.has(link)) return;
        // Must contain an img to be a product card
        if (!link.querySelector('img')) return;

        const match = link.getAttribute('href').match(/\/products\/([a-zA-Z0-9\-_]+)/);
        if (!match) return;

        const handle = match[1];
        this._processedLinks.add(link);

        if (!toResolve.has(handle)) {
          toResolve.set(handle, []);
        }
        toResolve.get(handle).push(link);
      });

      if (!toResolve.size) return;

      this._resolveHandlesAndOverlay(toResolve);
    },

    /**
     * Fetch /products/HANDLE.js in batches to get numeric product IDs, then inject overlays.
     */
    _resolveHandlesAndOverlay(handleMap) {
      const handles = Array.from(handleMap.keys());
      const BATCH = 6;
      const batches = [];

      for (let i = 0; i < handles.length; i += BATCH) {
        batches.push(handles.slice(i, i + BATCH));
      }

      const productIdMap = new Map(); // handle → productId

      const processBatch = (batchIndex) => {
        if (batchIndex >= batches.length) {
          this._injectAllOverlays(handleMap, productIdMap);
          return;
        }

        const batch = batches[batchIndex];
        const promises = batch.map((handle) =>
          fetch(`/products/${handle}.js`)
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
              if (data && data.id) {
                productIdMap.set(handle, String(data.id));
              }
            })
            .catch(() => {})
        );

        Promise.all(promises).then(() => processBatch(batchIndex + 1));
      };

      processBatch(0);
    },

    /**
     * After handle resolution, inject overlay buttons and batch-check wishlisted state.
     */
    _injectAllOverlays(handleMap, productIdMap) {
      const allProductIds = [];

      handleMap.forEach((links, handle) => {
        const productId = productIdMap.get(handle);
        if (!productId) return;

        links.forEach((link) => {
          this._addOverlayHeart(link, productId);
        });

        if (!allProductIds.includes(productId)) {
          allProductIds.push(productId);
        }
      });

      // Batch check if customer is logged in
      if (this._overlayCustomerId && allProductIds.length) {
        this._checkOverlays(allProductIds);
      }
    },

    /**
     * Add an overlay heart button onto a product card link.
     */
    _addOverlayHeart(link, productId) {
      // Ensure parent is positioned
      const parent = link.parentElement;
      if (parent) {
        const pos = getComputedStyle(parent).position;
        if (pos === 'static') parent.style.position = 'relative';
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pw-overlay-heart';
      btn.dataset.pwProductId = productId;
      btn.setAttribute('aria-label', 'Add to Wishlist');
      btn.innerHTML = HEART_SVG;

      if (!this._overlayCustomerId) {
        btn.disabled = true;
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this._overlayCustomerId) return;

        const isActive = btn.classList.contains('pw-overlay--active');
        // Optimistic
        this._setOverlayActive(btn, !isActive);
        this._syncOverlays(productId, !isActive);

        fetch(PROXY, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: productId }),
        })
          .then((r) => {
            if (!r.ok) throw new Error(r.statusText);
            return r.json();
          })
          .then((data) => {
            this._syncOverlays(productId, !!data.wishlisted);
          })
          .catch((err) => {
            console.error('[PureWishlist] overlay toggle failed', err);
            this._syncOverlays(productId, isActive);
          });
      });

      // Insert before the link (inside the same parent) so it overlays the image
      if (parent) {
        parent.insertBefore(btn, link);
      }
    },

    /**
     * Batch check overlay hearts for wishlisted state.
     */
    _checkOverlays(productIds) {
      fetch(`${PROXY}?action=check&products=${productIds.join(',')}`, {
        credentials: 'same-origin',
      })
        .then((r) => r.json())
        .then((data) => {
          const set = new Set((data.wishlisted || []).map(String));
          document.querySelectorAll('.pw-overlay-heart').forEach((btn) => {
            if (set.has(btn.dataset.pwProductId)) {
              this._setOverlayActive(btn, true);
            }
          });
        })
        .catch((err) => console.error('[PureWishlist] overlay check failed', err));
    },

    /**
     * Toggle filled/outline state on an overlay button.
     */
    _setOverlayActive(btn, active) {
      if (active) {
        btn.classList.add('pw-overlay--active');
        btn.setAttribute('aria-label', 'Remove from Wishlist');
      } else {
        btn.classList.remove('pw-overlay--active');
        btn.setAttribute('aria-label', 'Add to Wishlist');
      }
    },

    /**
     * Sync all overlay hearts (and manual buttons) for a given product ID.
     */
    _syncOverlays(productId, active) {
      document.querySelectorAll(`.pw-overlay-heart[data-pw-product-id="${productId}"]`).forEach((btn) => {
        this._setOverlayActive(btn, active);
      });
      // Also sync manual buttons
      document.querySelectorAll(`[data-pw-button][data-product-id="${productId}"]`).forEach((wrap) => {
        this._setActive(wrap, active);
      });
    },

    /**
     * Watch for DOM changes (infinite scroll, AJAX filters) and re-scan.
     */
    _observeDOM() {
      let debounceTimer = null;
      const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this._scanAndInject(), 300);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    },

    /* ------------------------------------------------------------------ */
    /*  Helpers                                                           */
    /* ------------------------------------------------------------------ */

    _hasCustomer() {
      // Check buttons for a non-empty customer-id
      for (const btn of this.buttons) {
        if (btn.dataset.customerId) return true;
      }
      // Check embed script
      const embedScript = document.querySelector('script[data-pw-embed]');
      if (embedScript && embedScript.dataset.pwCustomerId) return true;
      // On the page block the presence of the grid implies customer is logged in
      if (this.page && document.querySelector('[data-pw-grid]')) return true;
      return false;
    },
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PureWishlist.init());
  } else {
    PureWishlist.init();
  }

  // Expose for external use
  window.PureWishlist = PureWishlist;
})();
