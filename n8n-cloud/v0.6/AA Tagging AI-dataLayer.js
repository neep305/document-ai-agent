// Call this on every page load or SPA route change
window.adobeDataLayer.push({
  // ACDL event name
  event: "page-view",

  // Page meta (XDM-style: web.webPageDetails)
  web: {
    webPageDetails: {
      name: "home",               // page name (home, plp, pdp, cart, checkout, order-confirmation, etc.)
      siteSection: "home",        // high-level section
      URL: window.location.href
    }
  },

  // Login status & member tier
  user: {
    // "anonymous" when not logged in
    loginStatus: "logged-in",
    profile: {
      // Avoid raw PII; use internal or hashed ID
      customerId: "abc123hashed",
      memberTier: "GOLD"          // GOLD / SILVER / BRONZE / NONE
    }
  }
});


// Home Page
adobeDataLayer.push({
  event: "page-view",
  pageType: "home",
  web: {
    webPageDetails: {
      name: "home",
      siteSection: "home",
      URL: window.location.href
    }
  },
  user: {
    loginStatus: "anonymous"
  }
});

//PLP Page
adobeDataLayer.push({
  event: "page-view",
  pageType: "product-list",
  web: {
    webPageDetails: {
      name: "plp:running-shoes",
      siteSection: "category:shoes",
      URL: window.location.href
    }
  },
  user: {
    loginStatus: "logged-in",
    profile: {
      customerId: "abc123hashed",
      memberTier: "SILVER"
    }
  }
});

//PDP Page
adobeDataLayer.push({
  event: "page-view",
  pageType: "product-detail",
  web: {
    webPageDetails: {
      name: "pdp:shoe:PRD-001234",
      siteSection: "category:shoes",
      URL: window.location.href
    }
  },
  product: {
    id: "PRD-001234",
    name: "Super Run Pro 2",
    category: "shoes/running",
    brand: "Fluffy Sports",
    price: 99000,
    currency: "KRW"
  },
  user: {
    loginStatus: "logged-in",
    profile: {
      customerId: "abc123hashed",
      memberTier: "GOLD"
    }
  }
});

//Cart Page
adobeDataLayer.push({
  event: "page-view",
  pageType: "cart",
  web: {
    webPageDetails: {
      name: "cart",
      siteSection: "cart",
      URL: window.location.href
    }
  },
  // Will map directly to xdm.productListItems
  productListItems: [
    {
      SKU: "PRD-001234",
      name: "Super Run Pro 2",
      category: "shoes/running",
      brand: "Fluffy Sports",
      priceTotal: 99000,
      currencyCode: "KRW",
      quantity: 1
    },
    {
      SKU: "PRD-009999",
      name: "Running Socks",
      category: "accessories/socks",
      brand: "Fluffy Sports",
      priceTotal: 12000,
      currencyCode: "KRW",
      quantity: 2
    }
  ],
  user: {
    loginStatus: "logged-in",
    profile: {
      customerId: "abc123hashed",
      memberTier: "GOLD"
    }
  }
});

//Checkout Page
adobeDataLayer.push({
  event: "page-view",
  pageType: "checkout",
  web: {
    webPageDetails: {
      name: "checkout:step1",
      siteSection: "checkout",
      URL: window.location.href
    }
  },
  productListItems: [
    // Same structure as cart
  ],
  user: {
    loginStatus: "logged-in",
    profile: {
      customerId: "abc123hashed",
      memberTier: "GOLD"
    }
  }
});

//Order Confirmation
adobeDataLayer.push({
  event: "page-view",
  pageType: "order-confirmation",
  web: {
    webPageDetails: {
      name: "order-confirmation",
      siteSection: "checkout",
      URL: window.location.href
    }
  },
  productListItems: [
    // Purchased items
  ],
  commerce: {
    order: {
      purchaseID: "ORDER-20250101-000123",
      currencyCode: "KRW",
      priceTotal: 123000,
      payments: [
        {
          currencyCode: "KRW",
          paymentAmount: 123000,
          paymentType: "credit-card"
        }
      ]
    },
    purchases: {
      id: "ORDER-20250101-000123",
      value: 1
    }
  },
  user: {
    loginStatus: "logged-in",
    profile: {
      customerId: "abc123hashed",
      memberTier: "GOLD"
    }
  }
});
