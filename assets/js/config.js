/* =========================================================================
   ZEBRA VERDE — STORE CONFIGURATION
   Edit these values to switch payments on. Nothing secret goes in this file:
   the Wompi *integrity secret* lives only in the backend (Google Apps Script).
   ========================================================================= */
window.ZV_CONFIG = {
  currency: 'COP',

  /* Wompi (Bancolombia) — Web Checkout.
     publicKey:          "pub_prod_..." (or "pub_test_..." for sandbox) from the Wompi dashboard.
     env:                "production" or "sandbox" (must match the key).
     signatureEndpoint:  URL of the deployed Apps Script web app (backend/apps-script/Code.gs).
                         While empty, checkout falls back to "Complete with a Client Advisor". */
  wompi: {
    publicKey: '',
    env: 'production',
    signatureEndpoint: ''
  },

  /* Client Advisor WhatsApp (international format, digits only). */
  whatsapp: '573114826090',
  advisorEmail: 'latinamerica@contact.zebraverde.com',

  /* Shipping. Amounts in COP. null = quoted by a Client Advisor. */
  shipping: {
    CO: 0,
    CO_label: 'Complimentary',
    international: null
  }
};
