/**
 * Pure Wishlist — Theme Extension JS
 * Handles wishlist button toggling and wishlist page rendering.
 */

(function () {
  'use strict';

  const PROXY = '/apps/wishlist';

  const PureWishlist = {
    /** Track initialised state to avoid double-init */
    _ready: false,

    /**
     * Entry point. Discovers buttons and the page grid, then hydrates state.
     */
    init() {
      if (this._ready) return;
      this._ready = true;

      this.buttons = document.querySelectorAll('[data-pw-button]');
      this.page = document.querySelector('[data-pw-page]');

      // If no customer id on any button, customer is logged out — bail.
      const hasCustomer = this._hasCustomer();

      if (this.buttons.length && hasCustomer) {
        this._checkButtons();
        this._bindButtons();
      }

      if (this.page && hasCustomer) {
        this.loadWishlistPage();
      }
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
          // data.wishlisted expected as array of product id strings
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
          // Server is source of truth — reconcile.
          this._setActive(wrapEl, !!data.wishlisted);
        })
        .catch((err) => {
          console.error('[PureWishlist] toggle failed', err);
          // Revert on error
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
     * Expected product shape: { id, title, url, image, price, variant_id }
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

      // Add to cart
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

      // Remove from wishlist
      if (remove) {
        remove.addEventListener('click', () => {
          this.toggle(product.id, { classList: { contains: () => true, add() {}, remove() {} } });
          card.remove();
          // If grid now empty, show empty state
          if (!grid.children.length) {
            const emptyEl = document.querySelector('[data-pw-empty]');
            if (emptyEl) emptyEl.style.display = '';
          }
        });
      }

      grid.appendChild(clone);
    },

    /* ------------------------------------------------------------------ */
    /*  Helpers                                                           */
    /* ------------------------------------------------------------------ */

    _hasCustomer() {
      // Check buttons for a non-empty customer-id
      for (const btn of this.buttons) {
        if (btn.dataset.customerId) return true;
      }
      // On the page block the presence of the grid implies customer is logged in
      // (Liquid already gates it).
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
