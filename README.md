# Zebra Verde — Website & Store

Luxury e-commerce site for **Zebra Verde**, in English, built as a static site (HTML/CSS/JS) on GitHub Pages.

Live: https://yeniferyasalejo-dev.github.io/zebraverde/

| Page | Path |
|---|---|
| Home (dark emerald) | `/` |
| Home (white) | `/white.html` |
| Collection | `/shop/` (filters: `#boots`, `#ankle-boots`, `#ballerinas`, `#bags`) |
| Product pages | `/shop/<slug>/` |
| Bag | `/bag/` |
| Checkout | `/checkout/` |
| Payment result (Wompi redirect) | `/order/` |

## How it works

- **Catalogue**: `data/products.json` — 10 products taken from the WooCommerce store (prices in COP, colours, sizes, photos).
  Photos are currently served from `zebraverde.com/wp-content/uploads/`.
- **Build**: `python3 tools/build.py` generates every page from `data/products.json` + `src/`. Product pages are static HTML with
  schema.org `Product` data (SEO). Edit the templates in `src/` and the generator, not the generated pages.
- **Bag**: stored in the visitor's browser (`localStorage`).
- **Payments — Wompi Web Checkout**: the browser asks the backend to create the order; the backend recalculates the total from its own
  price list, saves the order and returns the integrity signature; the customer is redirected to Wompi and back to `/order/`.
- **Client Advisor fallback**: while Wompi is not connected (or for international deliveries) the checkout sends the full order by WhatsApp.

## Switching payments on

1. Deploy `backend/apps-script/Code.gs` in a Google Sheet (instructions at the top of the file).
2. In `assets/js/config.js` fill `wompi.publicKey` (pub_prod_…) and `wompi.signatureEndpoint` (the Apps Script `/exec` URL).
3. In Wompi set the events URL to the same `/exec` URL so order statuses update in the sheet.

The Wompi **integrity** and **events** secrets live only in the Apps Script properties — never in this repository.

## Next step

Google Sheets as the product database: the `Products` sheet feeds `data/products.json` and a GitHub Action rebuilds the site.
