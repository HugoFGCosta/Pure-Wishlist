/**
 * Pure Wishlist — Theme Extension JS
 * Handles wishlist button toggling, wishlist page rendering,
 * auto-injected heart overlays on product card images,
 * and support for the main product page image.
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
      
      // Explicit support for Product Page main image
      this._injectProductPage();
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

      // Optimistic UI + invalidate cache immediately
      this._setActive(wrapEl, !isActive);
      try { sessionStorage.removeItem('pw_wishlisted'); } catch (e) {}

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
      const embedEl = document.querySelector('[data-pw-embed]');
      if (!embedEl) return;

      this._overlayCustomerId = embedEl.dataset.pwCustomerId || null;
      this._overlayColor = embedEl.dataset.pwColor || '#ff0000';
      this._overlayPosition = embedEl.dataset.pwPosition || 'top-right';

      document.documentElement.style.setProperty('--pw-overlay-color', this._overlayColor);

      // Scan immediately — no need to wait for any fetch
      this._scanAndInject();
      this._observeDOM();
    },

    /**
     * Find the card-level container near a product link.
     * Never returns the <a> itself — sliders have one <a> per slide, which
     * would inject a heart on every slide causing duplicates during transitions.
     */
    _findImageContainer(link) {
      // Walk up from the link's parent to find a card-level container.
      let el = link.parentElement;
      for (let i = 0; i < 8 && el && el !== document.body; i++) {
        const tag = el.tagName;
        // <li> and <article> are reliable card-level wrappers in any theme
        if (tag === 'LI' || tag === 'ARTICLE') return el;
        // A div/section that contains both an image AND a non-image product link = full card
        if (tag === 'DIV' || tag === 'SECTION') {
          if (el.querySelector('img')) {
            const hasTextLink = Array.from(el.querySelectorAll('a[href*="/products/"]'))
              .some(a => !a.querySelector('img'));
            if (hasTextLink) return el;
          }
        }
        el = el.parentElement;
      }
      // Fallback: first non-anchor ancestor that contains an image
      el = link.parentElement;
      while (el && el !== document.body) {
        if (el.tagName !== 'A' && el.querySelector('img')) return el;
        el = el.parentElement;
      }
      return null;
    },

    /**
     * Inject heart on the main product image (Product Page).
     */
    _injectProductPage() {
      // 1. Check if we are on a product page
      if (!window.location.pathname.includes('/products/')) return;

      // 2. Try to get Product ID
      let productId = null;
      if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
        productId = window.ShopifyAnalytics.meta.product.id;
      }
      
      // Fallback: scrape from standard input
      if (!productId) {
         const input = document.querySelector('input[name="product-id"], input[name="id"]'); 
         if (input) productId = input.value;
      }

      // Fallback: fetch .js
      if (!productId) {
         // Prevent flood of fetches if we already tried
         if (this._checkedProductPage) return; 
         this._checkedProductPage = true;

         fetch(window.location.pathname + '.js')
           .then(r => r.json())
           .then(data => {
              if (data && data.id) {
                 this._injectProductPageWithId(String(data.id));
              }
           })
           .catch(() => {});
         return;
      }

      this._injectProductPageWithId(String(productId));
    },

    _injectProductPageWithId(productId) {
      const injectOnce = (el) => {
        if (!el || el.querySelector('.pw-overlay-heart')) return false;
        this._addOverlayHeart(el, productId);
        if (this._overlayCustomerId) this._checkOverlays([productId]);
        return true;
      };

      // 1. Gallery-level custom elements (Horizon, Dawn 15+, etc.)
      const galleryEls = ['media-gallery', 'slider-component', 'product-media-gallery'];
      for (const tag of galleryEls) {
        const el = document.querySelector(tag);
        if (el && el.querySelector('img') && injectOnce(el)) return;
      }

      // 2. Find first slide-level element, then walk up to gallery wrapper
      const slideSelectors = [
        '.product-media',
        '.product-media-container',
        '.product__media-item',
        '.product-gallery__image',
        '.product-single__media',
        '.product__main-photos',
        '.product-image-main',
        '.product__image-wrapper',
        '[data-product-single-media-wrapper]',
        '.product-gallery-item',
        '.product__slide',
        '.slick-slide',
        '.swiper-slide',
      ];

      let firstSlide = null;
      let matchedSel = null;
      for (const sel of slideSelectors) {
        const el = document.querySelector(sel);
        if (el && el.querySelector('img')) { firstSlide = el; matchedSel = sel; break; }
      }

      // 3. Last resort: find any product image on the page
      if (!firstSlide) {
        const img = document.querySelector(
          '.product-single__photo, .product__media img, [data-product-featured-image], main img'
        );
        if (img) { firstSlide = img.parentElement; matchedSel = null; }
      }

      if (!firstSlide) return;

      // Walk UP from firstSlide to find the gallery wrapper
      let gallery = firstSlide.parentElement;
      for (let i = 0; i < 6 && gallery && gallery !== document.body; i++) {
        const count = matchedSel
          ? gallery.querySelectorAll(matchedSel).length
          : gallery.querySelectorAll('img').length;
        if (count > 1) break;
        gallery = gallery.parentElement;
      }

      if (!gallery || gallery === document.body) gallery = firstSlide.parentElement;

      injectOnce(gallery);
    },

    /**
     * Scan DOM for product links, find image containers, extract handles, inject hearts.
     */
    _scanAndInject() {
      const links = document.querySelectorAll('a[href*="/products/"]');
      const toResolve = new Map(); // handle → [imageContainer, ...]

      links.forEach((link) => {
        if (this._processedLinks.has(link)) return;

        const match = link.getAttribute('href').match(/\/products\/([a-zA-Z0-9\-_]+)/);
        if (!match) return;

        const handle = match[1];
        const container = this._findImageContainer(link);
        if (!container) return;
        // Skip if this container already has an overlay
        if (container.querySelector('.pw-overlay-heart')) {
          this._processedLinks.add(link);
          return;
        }

      this._processedLinks.add(link);

            if (!toResolve.has(handle)) {
              toResolve.set(handle, []);
            }
            const containers = toResolve.get(handle);
            if (!containers.includes(container)) containers.push(container);
          });
    
          // 2. Also retry product page injection (in case gallery loaded late)
          this._injectProductPage();
    
          if (!toResolve.size) return;
    
          this._resolveHandlesAndOverlay(toResolve);
        },

    /**
     * Resolve product handles → numeric IDs. Uses sessionStorage cache to skip
     * fetches for handles we've already resolved in this browser session.
     */
    _resolveHandlesAndOverlay(handleMap) {
      const CACHE_KEY = 'pw_handle_cache';
      let cache = {};
      try { cache = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}'); } catch (e) {}

      const productIdMap = new Map();
      const toFetch = [];

      // Resolve cached handles instantly
      for (const handle of handleMap.keys()) {
        if (cache[handle]) {
          productIdMap.set(handle, cache[handle]);
        } else {
          toFetch.push(handle);
        }
      }

      // All cached — inject immediately
      if (!toFetch.length) {
        this._injectAllOverlays(handleMap, productIdMap);
        return;
      }

      // Fetch uncached handles in parallel (all at once, browser limits concurrency)
      const promises = toFetch.map((handle) =>
        fetch(`/products/${handle}.js`)
          .then((r) => r.ok ? r.json() : null)
          .then((data) => {
            if (data && data.id) {
              const id = String(data.id);
              productIdMap.set(handle, id);
              cache[handle] = id;
            }
          })
          .catch(() => {})
      );

      Promise.all(promises).then(() => {
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
        this._injectAllOverlays(handleMap, productIdMap);
      });
    },

    /**
     * After handle resolution, inject overlay buttons and batch-check wishlisted state.
     */
    _injectAllOverlays(handleMap, productIdMap) {
      const allProductIds = [];

      handleMap.forEach((containers, handle) => {
        const productId = productIdMap.get(handle);
        if (!productId) return;

        containers.forEach((container) => {
          this._addOverlayHeart(container, productId);
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
     * Add an overlay heart button onto a product card container.
     */
    _addOverlayHeart(container, productId) {
      // Ensure container is positioned
      const pos = getComputedStyle(container).position;
      if (pos === 'static') container.style.position = 'relative';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pw-overlay-heart pw-overlay-heart--' + this._overlayPosition;
      btn.dataset.pwProductId = productId;
      btn.setAttribute('aria-label', 'Add to Wishlist');
      btn.innerHTML = HEART_SVG;
      // Apply color directly inline to avoid CSS variable cascade issues
      btn.style.color = this._overlayColor;

      if (!this._overlayCustomerId) {
        btn.disabled = true;
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this._overlayCustomerId) return;

        const isActive = btn.classList.contains('pw-overlay--active');
        // Optimistic UI + invalidate cache immediately (before POST)
        this._setOverlayActive(btn, !isActive);
        this._syncOverlays(productId, !isActive);
        try { sessionStorage.removeItem('pw_wishlisted'); } catch (e) {}

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

      container.appendChild(btn);
    },

    /**
     * Batch check overlay hearts for wishlisted state.
     * Uses sessionStorage with 60s TTL for instant rendering on repeat visits.
     */
    _checkOverlays(productIds) {
      const CACHE_KEY = 'pw_wishlisted';
      const TTL = 60000; // 60 seconds

      // Try cache first
      try {
        const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
        if (cached && Date.now() - cached.t < TTL) {
          const set = new Set(cached.ids);
          document.querySelectorAll('.pw-overlay-heart').forEach((btn) => {
            if (set.has(btn.dataset.pwProductId)) this._setOverlayActive(btn, true);
          });
          return;
        }
      } catch (e) {}

      fetch(`${PROXY}?action=check&products=${productIds.join(',')}`, {
        credentials: 'same-origin',
      })
        .then((r) => r.json())
        .then((data) => {
          const ids = (data.wishlisted || []).map(String);
          const set = new Set(ids);
          document.querySelectorAll('.pw-overlay-heart').forEach((btn) => {
            if (set.has(btn.dataset.pwProductId)) this._setOverlayActive(btn, true);
          });
          // Cache result
          try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), ids })); } catch (e) {}
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
      // Check embed config element
      const embedEl = document.querySelector('[data-pw-embed]');
      if (embedEl && embedEl.dataset.pwCustomerId) return true;
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
