// adobeDataLayer.js for GSSHOP
window.adobeDataLayer = window.adobeDataLayer || [];

// 홈 페이지 트래킹 함수unction trackHomePage() {
  window.adobeDataLayer.push({
    event: 'page_view', // 페이지 뷰 이벤트
    web: {
      pageName: '<홈_페이지_이름>', // SPA 페이지명
      siteSection: '<사이트_섹션>',
      language: '<언어>',
      eVar18: '<SPA_페이지_이름>', // SPA Page Name
      eVar19: '<디바이스_타입>', // Device Type
    },
    user: {
      crmId: '<CRM_ID>', // eVar20
      loyaltyGrade: '<등급>', // eVar14
      audienceSegment: '<오디언스_세그먼트>', // eVar1
    },
    commerce: {},
    product: {},
  });
}

// 카테고리 페이지 트래킹 함수
function trackCategoryPage() {
  window.adobeDataLayer.push({
    event: 'category_view',
    web: {
      pageName: '<카테고리_페이지_이름>',
      categoryId: '<카테고리_ID>',
      eVar18: '<SPA_페이지_이름>',
      eVar19: '<디바이스_타입>',
    },
    user: {
      crmId: '<CRM_ID>',
      loyaltyGrade: '<등급>',
      audienceSegment: '<오디언스_세그먼트>',
    },
    commerce: {},
    product: {},
  });
}

// 상품 상세 페이지 트래킹 함수
function trackPDPPage() {
  window.adobeDataLayer.push({
    event: 'product_view',
    web: {
      pageName: '<PDP_페이지_이름>',
      eVar5: '<검색_키워드>', // Search Keyword
      eVar8: '<리뷰_평점>', // Review Rating
      eVar18: '<SPA_페이지_이름>',
      eVar19: '<디바이스_타입>',
    },
    user: {
      crmId: '<CRM_ID>',
      loyaltyGrade: '<등급>',
      audienceSegment: '<오디언스_세그먼트>',
    },
    product: {
      productId: '<상품_ID>',
      productName: '<상품_이름>',
      category: '<카테고리>',
      price: '<가격>',
      eVar8: '<리뷰_평점>',
    },
    commerce: {},
  });
}

// 검색 결과 페이지 트래킹 함수
function trackSearchPage() {
  window.adobeDataLayer.push({
    event: 'search',
    web: {
      pageName: '<검색_페이지_이름>',
      eVar5: '<검색_키워드>',
      eVar18: '<SPA_페이지_이름>',
      eVar19: '<디바이스_타입>',
    },
    user: {
      crmId: '<CRM_ID>',
      loyaltyGrade: '<등급>',
      audienceSegment: '<오디언스_세그먼트>',
    },
    commerce: {},
    product: {},
  });
}

// 장바구니 페이지 트래킹 함수
function trackCartPage() {
  window.adobeDataLayer.push({
    event: 'cart_view',
    web: {
      pageName: '<장바구니_페이지_이름>',
      eVar10: '<카트_리커버리_캠페인_ID>',
      eVar18: '<SPA_페이지_이름>',
      eVar19: '<디바이스_타입>',
    },
    user: {
      crmId: '<CRM_ID>',
      loyaltyGrade: '<등급>',
      audienceSegment: '<오디언스_세그먼트>',
    },
    commerce: {
      cartValue: '<장바구니_총액>',
      cartItems: '<장바구니_상품_리스트>',
    },
    product: {},
  });
}

// 체크아웃 페이지 트래킹 함수
function trackCheckoutPage() {
  window.adobeDataLayer.push({
    event: 'checkout',
    web: {
      pageName: '<체크아웃_페이지_이름>',
      eVar18: '<SPA_페이지_이름>',
      eVar19: '<디바이스_타입>',
    },
    user: {
      crmId: '<CRM_ID>',
      loyaltyGrade: '<등급>',
      audienceSegment: '<오디언스_세그먼트>',
    },
    commerce: {
      checkoutStep: '<체크아웃_스텝>',
      checkoutValue: '<체크아웃_금액>',
    },
    product: {},
  });
}

// 주문 완료 페이지 트래킹 함수
function trackOrderConfirmPage() {
  window.adobeDataLayer.push({
    event: 'order_complete',
    web: {
      pageName: '<주문완료_페이지_이름>',
      eVar18: '<SPA_페이지_이름>',
      eVar19: '<디바이스_타입>',
    },
    user: {
      crmId: '<CRM_ID>',
      loyaltyGrade: '<등급>',
      audienceSegment: '<오디언스_세그먼트>',
    },
    commerce: {
      orderId: '<주문_ID>',
      revenue: '<매출>',
      paymentType: '<결제_수단>',
    },
    product: {
      products: '<구매_상품_리스트>',
    },
  });
}

// 마이페이지(계정) 트래킹 함수
function trackAccountPage() {
  window.adobeDataLayer.push({
    event: 'account_view',
    web: {
      pageName: '<마이페이지_이름>',
      eVar18: '<SPA_페이지_이름>',
      eVar19: '<디바이스_타입>',
    },
    user: {
      crmId: '<CRM_ID>',
      loyaltyGrade: '<등급>',
      audienceSegment: '<오디언스_세그먼트>',
    },
    commerce: {},
    product: {},
  });
}

// 배너 클릭 이벤트 리스너
// 배너 클릭 시 eVar7, eVar6, event13 활용
function bannerClickHandler(e) {
  window.adobeDataLayer.push({
    event: 'banner_click',
    web: {
      eVar7: '<추천_소스>',
      eVar6: '<추천_엔진_타입>',
    },
    commerce: {},
    user: {},
    product: {},
  });
}
document.addEventListener('click', function(e) {
  if (e.target.closest('.banner')) {
    bannerClickHandler(e);
  }
});

// CTA 클릭 이벤트 리스너
function ctaClickHandler(e) {
  window.adobeDataLayer.push({
    event: 'cta_click',
    web: {
      eVar11: '<개인화_추천_타입>',
    },
    commerce: {},
    user: {},
    product: {},
  });
}
document.addEventListener('click', function(e) {
  if (e.target.closest('.cta')) {
    ctaClickHandler(e);
  }
});

// 내비게이션 클릭 이벤트 리스너
function navigationClickHandler(e) {
  window.adobeDataLayer.push({
    event: 'navigation_click',
    web: {
      navigationName: '<내비게이션_이름>',
    },
    commerce: {},
    user: {},
    product: {},
  });
}
document.addEventListener('click', function(e) {
  if (e.target.closest('.navigation')) {
    navigationClickHandler(e);
  }
});

// 추천 상품 클릭 이벤트 리스너
function recommendationClickHandler(e) {
  window.adobeDataLayer.push({
    event: 'recommendation_click',
    web: {
      eVar7: '<추천_소스>',
      eVar6: '<추천_엔진_타입>',
    },
    product: {
      productId: '<추천_상품_ID>',
    },
    commerce: {},
    user: {},
  });
}
document.addEventListener('click', function(e) {
  if (e.target.closest('.recommendation')) {
    recommendationClickHandler(e);
  }
});

// 동영상 클릭 이벤트 리스너
function videoClickHandler(e) {
  window.adobeDataLayer.push({
    event: 'video_click',
    web: {
      videoId: '<동영상_ID>',
      videoTitle: '<동영상_제목>',
    },
    commerce: {},
    user: {},
    product: {},
  });
}
document.addEventListener('click', function(e) {
  if (e.target.closest('.video')) {
    videoClickHandler(e);
  }
});

// 폼 제출 이벤트 리스너
function formSubmitHandler(e) {
  window.adobeDataLayer.push({
    event: 'form_submit',
    web: {
      formName: '<폼_이름>',
    },
    commerce: {},
    user: {},
    product: {},
  });
}
document.addEventListener('submit', function(e) {
  if (e.target.closest('form')) {
    formSubmitHandler(e);
  }
});

// 위시리스트 클릭 이벤트 리스너
function wishlistClickHandler(e) {
  window.adobeDataLayer.push({
    event: 'wishlist_click',
    web: {
      eVar16: '<위시리스트_알림_타입>',
    },
    product: {
      productId: '<상품_ID>',
    },
    commerce: {},
    user: {},
  });
}
document.addEventListener('click', function(e) {
  if (e.target.closest('.wishlist')) {
    wishlistClickHandler(e);
  }
});

// 각 페이지 진입 시 아래 함수 호출 필요
// 예시: trackHomePage();
