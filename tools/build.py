#!/usr/bin/env python3
"""
Zebra Verde static site generator.

  python3 tools/build.py

Reads  data/products.json + src/*  and writes the public pages:
  index.html, white.html, shop/, shop/<slug>/, bag/, checkout/, order/, sitemap.xml

Product pages are plain HTML (good for SEO); the bag and checkout run in the browser.
In the next step data/products.json will be refreshed from Google Sheets and this
script re-run automatically (GitHub Action).
"""
import json, html, os, shutil, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_URL = 'https://yeniferyasalejo-dev.github.io/zebraverde/'
E = html.escape

def rd(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()

def wr(p, s):
    full = os.path.join(ROOT, p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(s)

DATA = json.loads(rd('data/products.json'))
P = DATA['products']
CATS = {c['id']: c['name'] for c in DATA['categories']}
HEADER, FOOTER = rd('src/partials/header.html'), rd('src/partials/footer.html')


def v(p):
    return hashlib.md5(rd(p).encode()).hexdigest()[:8]



def money(n):
    return 'COP ' + f'{int(n):,}'


def img(im, big=False):
    path, ext, med, large, _ = im
    if big:
        return DATA['imageBase'] + path + (('-' + large) if large else '') + ext
    return DATA['imageBase'] + path + '-' + med + ext


def from_price(p):
    prices = [p['price']] + list((p.get('priceByColor') or {}).values())
    lo = min(prices)
    return ('From ' if len(set(prices)) > 1 else '') + money(lo)


def page(path, title, desc, body, page_id, theme='dark', header_solid=True, extra_head='', extra_js='', canonical=None):
    depth = path.count('/')
    r = '../' * depth
    head = HEADER.replace('{{R}}', r).replace('{{HEADER_CLASS}}', ' solid' if header_solid else '')
    foot = FOOTER.replace('{{R}}', r)
    can = SITE_URL + (canonical if canonical is not None else path.replace('index.html', ''))
    return f'''<!doctype html>
<html lang="en" data-theme="{theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{can}">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{can}">
<meta name="theme-color" content="{'#FFFFFF' if theme == 'light' else '#061B17'}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400;1,6..96,500&family=Montserrat:wght@200;300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{r}assets/css/zv.css?v={v('assets/css/zv.css')}">
{extra_head}</head>
<body data-page="{page_id}">
{head}
<main id="main">
{body}
</main>
{foot}
<script src="{r}assets/js/config.js?v={v('assets/js/config.js')}"></script>
<script src="{r}assets/js/store.js?v={v('assets/js/store.js')}"></script>
{extra_js}</body>
</html>
'''


def card(p, r, i, heading='h2'):
    main = p['images'][0]
    alt = next((im for im in p['images'][1:] if im[4] == main[4]), p['images'][1] if len(p['images']) > 1 else main)
    ncol = len(p['options']['Color'])
    badge = f'<span class="chip">{E(p["badge"])}</span>' if p.get('badge') else ''
    return f'''<a class="p-card reveal" href="{r}shop/{p['slug']}/" data-cat="{p['category']}" data-price="{p['price']}" data-order="{i}">
  <div class="plinth">{badge}<img class="main" src="{img(main)}" alt="{E(p['name'] + ' — ' + p['title'] + ', ' + (main[4] or ''))}" loading="lazy"><img class="alt" src="{img(alt)}" alt="" loading="lazy"></div>
  <div><{heading} class="serif">{E(p['name'])}</{heading}><p class="sub">{E(p['title'])}</p>
  <div class="meta"><span>{from_price(p)}</span><span class="c">{ncol} colour{'s' if ncol > 1 else ''}</span></div></div>
</a>'''


# ------------------------------------------------------------------ HOME
def build_home():
    body = rd('src/home-body.html')
    rail = '\n'.join(
        f'''    <article class="card">
      <a class="media plinth" href="shop/{p['slug']}/"><img src="{img(p['images'][0])}" alt="{E(p['name'] + ' — ' + p['title'])}" style="object-fit:cover" loading="lazy">{f'<span class="chip">{E(p["badge"])}</span>' if p.get('badge') else ''}</a>
      <div><h3><a href="shop/{p['slug']}/">{E(p['name'])}</a></h3><p class="desc">{E(p['title'])}</p><p class="price">{from_price(p)}</p></div>
    </article>''' for p in P)
    pick = {}
    for p in P:
        pick.setdefault(p['category'], p)
    cats = '\n'.join(
        f'''    <a class="cat reveal" href="shop/#{cid}"><div class="media plinth"><img src="{img(pick[cid]['images'][0])}" alt="{E(CATS[cid])}" style="object-fit:cover" loading="lazy"></div><div class="name">{E(CATS[cid])} <span aria-hidden="true">↗</span></div></a>'''
        for cid in CATS if cid in pick)
    body = body.replace('{{RAIL}}', rail).replace('{{CATS}}', cats)
    for theme, out in (('dark', 'index.html'), ('light', 'white.html')):
        wr(out, page(out, 'Zebra Verde — Haute Maroquinerie · Handcrafted Leather Shoes & Bags',
                     'Zebra Verde — handcrafted leather boots, ballerinas and bags made by Colombian master artisans since 2009. Art you can walk in.',
                     body, 'home', theme=theme, header_solid=False,
                     extra_js=f'<script src="assets/js/home.js?v={v("assets/js/home.js")}"></script>\n',
                     canonical='' if out == 'index.html' else 'white.html'))


# ------------------------------------------------------------------ SHOP
def build_shop():
    r = '../'
    pills = '<button class="pill" type="button" data-filter="all" aria-pressed="true">All</button>' + ''.join(
        f'<button class="pill" type="button" data-filter="{cid}" aria-pressed="false">{E(n)}</button>' for cid, n in CATS.items())
    grid = '\n'.join(card(p, r, i) for i, p in enumerate(P))
    body = f'''<div class="page">
<section class="shop-hero">
  <p class="eyebrow reveal">The Collection</p>
  <h1 class="reveal">Handcrafted in Colombia</h1>
  <p class="body reveal">Boots, ballerinas and bags shaped by hand in our Colombian atelier — Argentine and Colombian leathers, croc-embossed, suede, patent and calf hair.</p>
</section>
<div class="shop-bar">
  <div class="pills" role="group" aria-label="Filter by category">{pills}</div>
  <div style="display:flex;align-items:center;gap:16px"><span class="label" id="count" style="font-size:10px;color:var(--faint)"></span>
  <label class="sr-only" for="sort">Sort by</label><select id="sort"><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></div>
</div>
<div class="p-grid" id="grid">
{grid}
</div>
</div>'''
    ld = {"@context": "https://schema.org", "@type": "ItemList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": SITE_URL + 'shop/' + p['slug'] + '/', "name": p['name'] + ' ' + p['title']} for i, p in enumerate(P)]}
    wr('shop/index.html', page('shop/index.html', 'The Collection — Handcrafted Leather Boots, Ballerinas & Bags | Zebra Verde',
                               'Shop handcrafted leather boots, ankle boots, ballerinas and bags by Zebra Verde, made by Colombian master artisans.',
                               body, 'shop', extra_head=f'<script type="application/ld+json">{json.dumps(ld)}</script>\n'))


# --------------------------------------------------------------- PRODUCT
def build_products():
    for p in P:
        path = f"shop/{p['slug']}/index.html"
        r = '../../'
        thumbs = '\n'.join(
            f'<button type="button" class="thumb" data-large="{img(im, True)}" data-color="{E(im[4] or "")}" data-alt="{E(p["name"] + " — " + (im[4] or p["title"]))}" aria-label="View image {k + 1}{(" — " + E(im[4])) if im[4] else ""}" aria-current="{"true" if k == 0 else "false"}"><img src="{img(im)}" alt="" loading="lazy"></button>'
            for k, im in enumerate(p['images']))
        colors = ''.join(f'<button type="button" class="chipbtn" data-color="{E(c)}" aria-pressed="false">{E(c)}</button>' for c in p['options']['Color'])
        sizes = ''.join(f'<button type="button" class="chipbtn" data-size="{E(s)}" aria-pressed="false">{E(s)}</button>' for s in p['options']['Size'])
        is_shoe = p['category'] != 'bags'
        size_label = 'Size (EU)' if is_shoe else 'Size'
        details = ''.join(f'<li>{E(d)}</li>' for d in p['details'])
        care = ''.join(f'<li>{E(c)}</li>' for c in DATA['care'][p['care']])
        related = [q for q in P if q['category'] == p['category'] and q['id'] != p['id']]
        related += [q for q in P if q['category'] != p['category'] and q['id'] != p['id']]
        rel = '\n'.join(card(q, r, i, 'h3') for i, q in enumerate(related[:4]))
        pdata = {k: p[k] for k in ('id', 'name', 'title', 'price', 'slug')}
        pdata['priceByColor'] = p.get('priceByColor') or {}
        first = p['images'][0]
        body = f'''<div class="page">
<div class="pdp">
  <div>
    <nav class="crumbs" aria-label="Breadcrumb"><a href="{r}">Home</a><span aria-hidden="true">/</span><a href="{r}shop/">Collection</a><span aria-hidden="true">/</span><a href="{r}shop/#{p['category']}">{E(CATS[p['category']])}</a></nav>
    <div class="gallery">
      <div class="plinth main"><img id="mainImg" src="{img(first, True)}" alt="{E(p['name'] + ' — ' + (first[4] or p['title']))}" fetchpriority="high"></div>
      <div class="thumbs">{thumbs}</div>
    </div>
  </div>
  <div class="buy">
    <p class="eyebrow">{E(CATS[p['category']])} · Made in Colombia</p>
    <h1>{E(p['name'])}</h1>
    <p class="title">{E(p['title'])}</p>
    <p class="price" id="pPrice">{money(p['price'])}</p>
    <p class="body">{E(p['short'])}</p>
    <fieldset class="opt"><legend>Colour <span id="colorName"></span></legend><div class="row">{colors}</div></fieldset>
    <fieldset class="opt" id="sizeGroup"><legend>{size_label} <span id="sizeName">{'Select' if len(p['options']['Size']) > 1 else ''}</span></legend><div class="row">{sizes}</div></fieldset>
    <button type="button" class="btn solid" id="addBtn">Add to bag</button>
    <p class="add-msg" id="addMsg" role="status"></p>
    <a href="#" class="label ulink" id="advisorLink" style="align-self:flex-start">Ask a Client Advisor ↗</a>
    <div class="assure"><div>Handcrafted</div><div>Secure payment</div><div>Advisor support</div></div>
    <div class="acc">
      <details open><summary>Details</summary><ul>{details}</ul></details>
      <details><summary>Care</summary><ul>{care}</ul></details>
      <details><summary>Delivery &amp; assistance</summary><p>Each pair is finished by hand in our Colombian atelier. After your order, a Client Advisor will confirm the delivery time for your city. {'Our sizes are European (EU 35–41); if you are between sizes, an advisor will gladly help you choose.' if is_shoe else ''}</p></details>
    </div>
  </div>
</div>
<section class="related" aria-labelledby="rel-title">
  <div class="sec-head" style="padding-left:0;padding-right:0"><div class="titles"><p class="eyebrow">You may also like</p><h2 id="rel-title" style="font-size:clamp(36px,4vw,56px)">Complete the look</h2></div></div>
  <div class="p-grid" style="padding:0">{rel}</div>
</section>
</div>
<script type="application/json" id="pdata">{json.dumps(pdata)}</script>'''
        prices = [p['price']] + list((p.get('priceByColor') or {}).values())
        ld = {"@context": "https://schema.org", "@type": "Product", "name": p['name'] + ' — ' + p['title'],
              "image": [img(im, True) for im in p['images']], "description": p['short'], "sku": p['sku'],
              "brand": {"@type": "Brand", "name": "Zebra Verde"}, "category": CATS[p['category']],
              "offers": {"@type": "AggregateOffer", "priceCurrency": "COP", "lowPrice": min(prices), "highPrice": max(prices),
                         "availability": "https://schema.org/InStock", "url": SITE_URL + 'shop/' + p['slug'] + '/'}}
        wr(path, page(path, f"{p['name']} {p['title']} | Zebra Verde",
                      f"{p['name']} — {p['title']}. {p['short']}"[:300], body, 'product',
                      extra_head=f'<meta property="og:image" content="{img(first, True)}">\n<script type="application/ld+json">{json.dumps(ld)}</script>\n'))


# ------------------------------------------------------ BAG / CHECKOUT / ORDER
COUNTRIES = [('CO', 'Colombia'), ('US', 'United States'), ('CA', 'Canada'), ('MX', 'Mexico'), ('PA', 'Panama'), ('EC', 'Ecuador'),
             ('PE', 'Peru'), ('CL', 'Chile'), ('AR', 'Argentina'), ('BR', 'Brazil'), ('ES', 'Spain'), ('FR', 'France'),
             ('IT', 'Italy'), ('DE', 'Germany'), ('GB', 'United Kingdom'), ('CN', 'China'), ('OT', 'Other')]


def build_flow():
    wr('bag/index.html', page('bag/index.html', 'Your Bag | Zebra Verde', 'Your Zebra Verde shopping bag.', '''<div class="page wrap">
<p class="eyebrow">Your selection</p>
<h1 style="font-size:clamp(48px,7vw,104px);line-height:1;margin:14px 0 48px">Your bag</h1>
<div id="bagWrap" aria-live="polite"></div>
</div>
<div style="height:120px"></div>''', 'bag'))

    opts = ''.join(f'<option value="{c}"{" selected" if c == "CO" else ""}>{n}</option>' for c, n in COUNTRIES)
    co = f'''<div class="page wrap" id="checkoutWrap">
<p class="eyebrow">Secure checkout</p>
<h1 style="font-size:clamp(48px,7vw,104px);line-height:1;margin:14px 0 56px">Checkout</h1>
<div class="co-grid">
<form class="co-form" id="checkoutForm" novalidate>
  <fieldset>
    <legend>Contact</legend>
    <div class="f full"><label for="email">Email *</label><input id="email" name="email" type="email" autocomplete="email" required></div>
    <div class="f"><label for="firstName">First name *</label><input id="firstName" name="firstName" autocomplete="given-name" required></div>
    <div class="f"><label for="lastName">Last name *</label><input id="lastName" name="lastName" autocomplete="family-name" required></div>
    <div class="f full"><label for="phone">Mobile phone *</label><input id="phone" name="phone" type="tel" autocomplete="tel" required placeholder="+57 300 000 0000"></div>
  </fieldset>
  <fieldset>
    <legend>Delivery</legend>
    <div class="f full"><label for="country">Country *</label><select id="country" name="country" autocomplete="country" required>{opts}</select></div>
    <div class="f full"><label for="address">Address *</label><input id="address" name="address" autocomplete="address-line1" required></div>
    <div class="f full"><label for="address2">Apartment, suite, building</label><input id="address2" name="address2" autocomplete="address-line2"></div>
    <div class="f"><label for="city">City *</label><input id="city" name="city" autocomplete="address-level2" required></div>
    <div class="f"><label for="region">Department / State *</label><input id="region" name="region" autocomplete="address-level1" required></div>
    <div class="f"><label for="postal">Postal code</label><input id="postal" name="postal" autocomplete="postal-code"></div>
    <div class="f full"><label for="notes">Gift note or delivery instructions</label><textarea id="notes" name="notes" rows="2"></textarea></div>
  </fieldset>
  <fieldset>
    <legend>Payment</legend>
    <div class="pay">
      <label class="opt-card"><input type="radio" name="pay" id="payWompi" value="wompi"><span><span class="t">Pay online with Wompi</span><span class="muted-sm" style="display:block" id="wompiNote"></span></span></label>
      <label class="opt-card"><input type="radio" name="pay" id="payAdvisor" value="advisor"><span><span class="t">Complete with a Client Advisor</span><span class="muted-sm" style="display:block">We will send your order by WhatsApp; an advisor confirms availability, delivery and a secure payment link.</span></span></label>
    </div>
  </fieldset>
  <p class="form-error" id="formError" role="alert"></p>
  <button type="submit" class="btn solid" id="submitBtn" style="width:100%;min-height:60px">Continue</button>
  <p class="muted-sm" id="advisorDone" hidden style="font-size:14px;color:var(--accent-text)">Your order has been sent to WhatsApp. A Client Advisor will reply shortly to confirm every detail.</p>
  <p class="muted-sm">By placing your order you agree to our terms and privacy policy. Payments are processed by Wompi (Bancolombia); Zebra Verde never sees your card details.</p>
</form>
<div id="checkoutSummary" aria-live="polite"></div>
</div>
</div>
<div style="height:120px"></div>'''
    wr('checkout/index.html', page('checkout/index.html', 'Checkout | Zebra Verde', 'Secure checkout — Zebra Verde.', co, 'checkout',
                                   extra_head='<meta name="robots" content="noindex">\n'))

    wr('order/index.html', page('order/index.html', 'Your Order | Zebra Verde', 'Order confirmation — Zebra Verde.', '''<div class="page wrap">
<div class="empty" id="orderBox" aria-live="polite"><p class="eyebrow">Checking your payment…</p></div>
</div>''', 'order', extra_head='<meta name="robots" content="noindex">\n'))


def build_sitemap():
    urls = ['', 'shop/'] + [f"shop/{p['slug']}/" for p in P]
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(
        f'  <url><loc>{SITE_URL}{u}</loc></url>\n' for u in urls) + '</urlset>\n'
    wr('sitemap.xml', xml)


if __name__ == '__main__':
    shutil.rmtree(os.path.join(ROOT, 'shop'), ignore_errors=True)
    build_home(); build_shop(); build_products(); build_flow(); build_sitemap()
    print('Built', len(P), 'products')
