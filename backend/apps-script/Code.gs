/**
 * ZEBRA VERDE — Store backend (Google Apps Script + Google Sheets)
 * -----------------------------------------------------------------
 * What it does
 *   1. createOrder  – recalculates the order total from the "Products" sheet
 *                     (never trusts prices sent by the browser), saves the order
 *                     in "Orders" and returns the Wompi integrity signature.
 *   2. Wompi events – receives Wompi's webhook (transaction.updated), verifies
 *                     its checksum and updates the order status in "Orders".
 *   3. products     – GET ?action=products returns the catalogue as JSON
 *                     (used in the next step to feed the website from Sheets).
 *
 * Setup (one time)
 *   a. Create a Google Sheet → Extensions → Apps Script → paste this file.
 *   b. Project Settings → Script properties:
 *        WOMPI_INTEGRITY_SECRET   (Wompi dashboard → Desarrolladores → Secretos para integración técnica → Integridad)
 *        WOMPI_EVENTS_SECRET      (same page → Eventos)
 *        CATALOG_URL              https://yeniferyasalejo-dev.github.io/zebraverde/data/products.json
 *   c. Run setup() once (authorise it). It creates the sheets and loads the products.
 *   d. Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone.
 *      Copy the /exec URL into assets/js/config.js → wompi.signatureEndpoint,
 *      and into Wompi → Desarrolladores → URL de eventos.
 */

var CURRENCY = 'COP';
var PRODUCT_HEADERS = ['id', 'name', 'title', 'category', 'price', 'price_by_color', 'colors', 'sizes', 'active'];
var ORDER_HEADERS = ['created_at', 'reference', 'status', 'amount_cop', 'email', 'first_name', 'last_name', 'phone',
  'country', 'address', 'address2', 'city', 'region', 'postal', 'notes', 'items', 'wompi_transaction_id', 'updated_at'];

/* ------------------------------------------------------------------ setup */
function setup() {
  var ss = SpreadsheetApp.getActive();
  var prod = ss.getSheetByName('Products') || ss.insertSheet('Products');
  var orders = ss.getSheetByName('Orders') || ss.insertSheet('Orders');
  if (orders.getLastRow() === 0) orders.appendRow(ORDER_HEADERS);
  orders.setFrozenRows(1);

  if (prod.getLastRow() <= 1) {
    prod.clear();
    prod.appendRow(PRODUCT_HEADERS);
    var url = PropertiesService.getScriptProperties().getProperty('CATALOG_URL');
    if (url) {
      var data = JSON.parse(UrlFetchApp.fetch(url).getContentText());
      data.products.forEach(function (p) {
        var pbc = Object.keys(p.priceByColor || {}).map(function (c) { return c + '=' + p.priceByColor[c]; }).join('; ');
        prod.appendRow([p.id, p.name, p.title, p.category, p.price, pbc,
          p.options.Color.join(', '), p.options.Size.join(', '), 'yes']);
      });
    }
  }
  prod.setFrozenRows(1);
}

/* ------------------------------------------------------------------ http */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'products';
  if (action === 'products') return json_({ products: readProducts_() });
  return json_({ ok: true });
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ error: 'Bad request' }); }
  if (body.action === 'createOrder') {
    try { return json_(createOrder_(body)); } catch (err) { return json_({ error: String(err.message || err) }); }
  }
  if (body.event && body.data) return json_(wompiEvent_(body));
  return json_({ error: 'Unknown action' });
}

/* -------------------------------------------------------------- products */
function readProducts_() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Products');
  var rows = sh.getDataRange().getValues(), head = rows.shift();
  return rows.filter(function (r) { return r[0]; }).map(function (r) {
    var o = {}; head.forEach(function (h, i) { o[h] = r[i]; });
    o.price = Number(o.price);
    o.priceByColor = {};
    String(o.price_by_color || '').split(';').forEach(function (kv) {
      var p = kv.split('='); if (p.length === 2) o.priceByColor[p[0].trim()] = Number(p[1]);
    });
    o.active = String(o.active).toLowerCase() !== 'no';
    return o;
  });
}

/* ---------------------------------------------------------------- orders */
function createOrder_(body) {
  var cfg = PropertiesService.getScriptProperties();
  var secret = cfg.getProperty('WOMPI_INTEGRITY_SECRET');
  if (!secret) return { error: 'Payments not configured' };

  var catalog = {};
  readProducts_().forEach(function (p) { catalog[p.id] = p; });

  var total = 0, lines = [];
  (body.items || []).forEach(function (it) {
    var p = catalog[it.id];
    if (!p || !p.active) throw new Error('Unknown product ' + it.id);
    var qty = Math.max(1, Math.min(9, parseInt(it.qty, 10) || 1));
    var unit = p.priceByColor[it.color] || p.price;
    total += unit * qty;
    lines.push(p.name + ' ' + p.title + ' | ' + it.color + ' | ' + it.size + ' | x' + qty + ' | ' + unit);
  });
  if (!total) return { error: 'Empty order' };

  var amountInCents = Math.round(total * 100);
  var reference = 'ZV-' + Utilities.formatDate(new Date(), 'America/Bogota', 'yyMMdd-HHmmss') + '-' +
    Math.random().toString(36).slice(2, 6).toUpperCase();
  var signature = sha256Hex_(reference + amountInCents + CURRENCY + secret);

  var c = body.customer || {};
  var sh = SpreadsheetApp.getActive().getSheetByName('Orders');
  sh.appendRow([new Date(), reference, 'CREATED', total, c.email, c.firstName, c.lastName, "'" + (c.phone || ''),
    c.country, c.address, c.address2, c.city, c.region, c.postal, c.notes, lines.join('\n'), '', new Date()]);

  return { reference: reference, amountInCents: amountInCents, currency: CURRENCY, signature: signature };
}

/* ------------------------------------------------------- wompi webhook */
function wompiEvent_(ev) {
  var secret = PropertiesService.getScriptProperties().getProperty('WOMPI_EVENTS_SECRET');
  var tx = ev.data && ev.data.transaction;
  if (!secret || !tx || !ev.signature) return { ok: false };

  // checksum = SHA256( values of signature.properties in order + timestamp + events secret )
  var concat = ev.signature.properties.map(function (path) {
    return path.split('.').reduce(function (o, k) { return o == null ? '' : o[k]; }, ev.data);
  }).join('') + ev.timestamp + secret;
  if (sha256Hex_(concat).toLowerCase() !== String(ev.signature.checksum).toLowerCase()) return { ok: false };

  var sh = SpreadsheetApp.getActive().getSheetByName('Orders');
  var refs = sh.getRange(2, 2, Math.max(1, sh.getLastRow() - 1), 1).getValues();
  for (var i = 0; i < refs.length; i++) {
    if (refs[i][0] === tx.reference) {
      sh.getRange(i + 2, 3).setValue(tx.status);
      sh.getRange(i + 2, 17).setValue(tx.id);
      sh.getRange(i + 2, 18).setValue(new Date());
      break;
    }
  }
  return { ok: true };
}

/* ------------------------------------------------------------- helpers */
function sha256Hex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
