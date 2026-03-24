# Adobe Launch 워크플로우 비교 분석 보고서

## 파일 비교
- **File A**: `document_ai_Tags_v2.0.json` (Tags v2.0)
- **File B**: `Adobe Launch API - Create rule,component.json` (Reference)

## 결론
**✅ Tags v2.0 파일이 더 안정적이고 완성도가 높음**

## 상세 비교

### 1. Trigger 방식
| 항목 | Tags v2.0 | Adobe Launch API |
|------|-----------|------------------|
| Type | Webhook (POST /tags) | Manual Trigger |
| 장점 | 외부 시스템 연동 가능, 비동기 처리 | 테스트 용이 |
| 운영 적합성 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

### 2. Descriptor Mapping (핵심 차이)

**Tags v2.0 (line 297):**
```javascript
const descriptorMapping = {
  "adobe-alloy/src/lib/actions/sendEvent.js": "adobe-alloy::actions::send-event",
  "core/src/lib/events/click.js": "core::events::click",
  "core/src/lib/events/libraryLoaded.js": "core::events::library-loaded",
  "core/src/lib/events/domReady.js": "core::events::dom-ready",
  "core/src/lib/conditions/customCode.js": "core::conditions::custom-code"
};

// Fallback 로직 적용
extensionDescriptorId: descriptorMapping[evt.modulePath] || evt.modulePath
```

**Adobe Launch API (line 213):**
```javascript
const descriptorMapping = {
  "adobe-alloy/src/lib/actions/sendEvent.js": "adobe-alloy::actions::send-event",
  "core/src/lib/events/click.js": "core::events::click"
}

// Fallback 없음
extensionDescriptorId: descriptorMapping[evt.modulePath]
```

**평가:**
- Tags v2.0: ⭐⭐⭐⭐⭐ (매핑 누락 시에도 작동 가능)
- Adobe Launch API: ⭐⭐ (매핑 없으면 실패 가능)

### 3. Rules 생성 방식

**Tags v2.0 (Prepare Rules Dynamic):**
```javascript
// Path A: launchPayload 사용 (우선순위)
if (launchPayloadContent) {
  const launchConfig = JSON.parse(launchPayloadContent);
  return launchConfig.rules.map(...)
}

// Path B: SDR data에서 자동 생성 (fallback)
else {
  const events = sdr.events || [];
  return events.map((evt, idx) => ({
    name: `Track - ${evt.event_name}`,
    events: [{ modulePath: 'core/src/lib/events/domReady.js' }],
    actions: [{ modulePath: 'adobe-alloy/src/lib/actions/sendEvent.js' }]
  }))
}
```

**Adobe Launch API:**
- 9개 rules 하드코딩
- 확장 불가능

**평가:**
- Tags v2.0: ⭐⭐⭐⭐⭐ (동적, 확장 가능)
- Adobe Launch API: ⭐⭐⭐ (정적, 테스트용)

### 4. Component 생성 API

**둘 다 동일한 Adobe Launch API 호출:**
```json
POST /properties/{PROPERTY_ID}/rule_components
{
  "data": {
    "type": "rule_components",
    "attributes": {
      "name": "...",
      "delegate_descriptor_id": "...",
      "settings": "...",
      "order": 0
    },
    "relationships": {
      "extension": { "data": { "id": "...", "type": "extensions" } },
      "rules": { "data": [{ "id": "...", "type": "rules" }] }
    }
  }
}
```

### 5. Extension 감지

**둘 다 동일:**
```javascript
const alloyExt = existingExtensions.find(ext =>
  ext.delegateDescriptorId?.includes('alloy') ||
  ext.delegateDescriptorId?.includes('adobe-cloud-connector') ||
  ext.name?.toLowerCase().includes('web sdk') ||
  ext.name?.toLowerCase().includes('alloy')
);
```

## 🔴 Tags v2.0의 개선 필요 사항

### 1. Descriptor Mapping 확장 (선택사항)
현재는 fallback이 있어서 작동하지만, 명시적 매핑 추가 권장:

```javascript
const descriptorMapping = {
  // Actions
  "adobe-alloy/src/lib/actions/sendEvent.js": "adobe-alloy::actions::send-event",
  "adobe-alloy/src/lib/actions/applyPropositions.js": "adobe-alloy::actions::apply-propositions",
  "adobe-alloy/src/lib/actions/applyResponse.js": "adobe-alloy::actions::apply-response",

  // Events
  "core/src/lib/events/click.js": "core::events::click",
  "core/src/lib/events/libraryLoaded.js": "core::events::library-loaded",
  "core/src/lib/events/domReady.js": "core::events::dom-ready",
  "core/src/lib/events/dataElementChange.js": "core::events::data-element-change",
  "core/src/lib/events/customEvent.js": "core::events::custom-event",

  // Conditions
  "core/src/lib/conditions/customCode.js": "core::conditions::custom-code",
  "core/src/lib/conditions/path.js": "core::conditions::path",
  "core/src/lib/conditions/valueComparison.js": "core::conditions::value-comparison",
  "core/src/lib/conditions/dataElementValue.js": "core::conditions::data-element-value"
};
```

### 2. Error Handling 강화 (권장)

**현재 (line 316):**
```javascript
// Component 생성 실패 시 조용히 Log Error로 이동
"Component Created?" → false → "Log Error" (NoOp)
```

**개선안:**
```javascript
// 실패한 component 정보를 callback에 포함
if (!$json.data) {
  return [{
    json: {
      error: true,
      componentName: $json.component.name,
      ruleName: $json.ruleName,
      message: 'Component creation failed'
    }
  }];
}
```

### 3. 완료 알림 개선 (선택사항)

**현재 (line 452):**
```javascript
return [{
  json: {
    success: true,
    message: 'Adobe Launch Rules deployed successfully',
    summary: {
      rulesCreated: items.length,
      componentsCreated: 'Events, Conditions, Actions included'
    }
  }
}];
```

**개선안:**
```javascript
const allComponents = $input.all();
const successCount = allComponents.filter(c => c.json.data).length;
const failCount = allComponents.filter(c => !c.json.data).length;

return [{
  json: {
    success: failCount === 0,
    message: failCount === 0
      ? 'Adobe Launch Rules deployed successfully'
      : `Deployed with ${failCount} errors`,
    summary: {
      rulesCreated: items.length,
      componentsCreated: successCount,
      componentsFailed: failCount
    }
  }
}];
```

## 최종 권장사항

### ✅ document_ai_Tags_v2.0.json 사용 권장

**이유:**
1. Webhook 기반으로 실제 운영에 적합
2. Fallback 로직으로 안정성 확보
3. 동적 rules 생성 지원
4. 비동기 처리 및 상태 알림 기능

**추가 개선 시:**
- Descriptor mapping 확장 (선택)
- Error handling 강화 (권장)

### 📋 Adobe Launch API 파일 용도

- 수동 테스트용
- Descriptor mapping 참고용
- 기본 workflow 학습용

## 테스트 체크리스트

- [ ] Webhook endpoint 설정 확인
- [ ] Adobe credentials 설정 확인
- [ ] Extension 설치 상태 확인 (Core, Alloy)
- [ ] 샘플 SDR data로 테스트
- [ ] launchPayload 형식 검증
- [ ] Component 생성 성공률 모니터링
- [ ] Callback URL 응답 확인
