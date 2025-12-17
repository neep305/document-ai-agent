"""
Sample e-commerce discovery data for testing
"""

SAMPLE_ECOMMERCE_DISCOVERY = {
    "client_info": {
        "company_name": "ShopKorea",
        "industry": "E-commerce",
        "vertical": "Fashion & Lifestyle",
        "website": "www.shopkorea.com",
        "platforms": ["Web", "Mobile App (iOS/Android)"]
    },

    "business_objectives": [
        "Understand customer purchase behavior and conversion funnel",
        "Optimize product recommendation effectiveness",
        "Measure marketing campaign ROI across channels",
        "Improve user experience based on navigation patterns",
        "Track cart abandonment and recovery strategies"
    ],

    "key_kpis": [
        {
            "kpi": "Conversion Rate",
            "definition": "Percentage of visitors who complete a purchase",
            "target": "3.5%"
        },
        {
            "kpi": "Average Order Value (AOV)",
            "definition": "Average transaction amount per order",
            "target": "$85"
        },
        {
            "kpi": "Cart Abandonment Rate",
            "definition": "Percentage of users who add items but don't complete purchase",
            "target": "<65%"
        },
        {
            "kpi": "Product View to Add-to-Cart Rate",
            "definition": "Percentage of product views that result in add-to-cart",
            "target": "15%"
        }
    ],

    "user_journeys": [
        {
            "journey": "Product Discovery & Purchase",
            "steps": [
                "Homepage visit",
                "Category browse / Search",
                "Product detail page view",
                "Add to cart",
                "View cart",
                "Checkout initiation",
                "Payment information",
                "Order confirmation"
            ]
        },
        {
            "journey": "Account Management",
            "steps": [
                "User registration",
                "Login",
                "Profile update",
                "Order history view",
                "Wishlist management"
            ]
        }
    ],

    "critical_events": [
        "Product view",
        "Add to cart",
        "Remove from cart",
        "Checkout initiation",
        "Purchase completion",
        "Search performed",
        "Filter applied",
        "Product recommendation click",
        "User registration",
        "User login"
    ],

    "data_requirements": {
        "product_data": [
            "Product ID",
            "Product name",
            "Product category (L1, L2, L3)",
            "Product price",
            "Product brand",
            "Stock status",
            "Discount/promotion applied"
        ],
        "user_data": [
            "User ID (hashed)",
            "User type (guest/registered/premium)",
            "User segment",
            "Login status"
        ],
        "transaction_data": [
            "Order ID",
            "Revenue",
            "Tax",
            "Shipping cost",
            "Payment method",
            "Coupon code used"
        ]
    },

    "technical_context": {
        "website_type": "Single Page Application (React)",
        "mobile_app": "Native (iOS Swift, Android Kotlin)",
        "tag_management": "Adobe Launch",
        "existing_analytics": "Google Analytics (to be replaced)",
        "data_layer": "Currently none - needs to be implemented"
    },

    "marketing_channels": [
        "Paid Search (Google Ads, Naver)",
        "Display Advertising",
        "Social Media (Instagram, Facebook, KakaoTalk)",
        "Email Marketing",
        "Affiliate Marketing",
        "Organic Search"
    ],

    "success_criteria": [
        "All critical user journeys tracked accurately",
        "Real-time dashboard showing key KPIs",
        "Marketing attribution report available",
        "Data quality >95% (validated tags firing correctly)"
    ]
}
