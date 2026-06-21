# Howdy! Eight! Dallas Itinerary

2026년 7월 16일부터 19일까지 진행되는 Dallas 및 Fort Worth 일정 안내 웹사이트입니다. Google Doc의 일정과 제공된 Drive 이미지를 기준으로 구성했습니다.

## Pages

| Route | 일정 |
| --- | --- |
| `index.html` | 4일 여정 안내 |
| `arrival.html` | 7월 16일 Dallas 도착 및 리셉션 |
| `day1.html` | 7월 17일 조별 선택 활동 |
| `day2.html` | 7월 18일 Fort Worth 전체 일정 |
| `departure.html` | 7월 19일 체크아웃 및 공항 이동 |
| `about.html` | Dallas–Fort Worth 역사, 명소 및 여행 정보 |

## Structure

- `data/itinerary.json`: 페이지, 일정, 장소, 링크, 이미지 출처를 담은 단일 데이터 소스
- `js/app.js`: `body[data-page]` 값에 따라 공통 UI를 렌더링하는 클라이언트 코드
- `css/style.css`: 로고에서 가져온 cream, navy, blue, red 기반의 반응형 디자인
- `images/dallas/`: Drive에서 내려받아 장소별로 정규화한 이미지
- `tests/test_itinerary.py`: 데이터, 경로, 이미지 매핑, 링크, 콘텐츠 정리 검증
- `tests/test_site.js`: Chrome과 Playwright를 이용한 렌더링 및 반응형 검증

이미지 데이터에는 로컬 경로와 함께 Drive의 원본 파일명인 `sourceName`이 기록됩니다. 정확히 매칭되는 이미지가 없는 일정은 다른 장소의 사진을 재사용하지 않고 브랜드 플레이스홀더를 표시합니다.

## Local Preview

```bash
python3 -m http.server 8082
```

브라우저에서 `http://localhost:8082/`를 엽니다. JSON을 불러오기 때문에 HTML 파일을 직접 여는 방식 대신 로컬 HTTP 서버를 사용해야 합니다.

## Verification

콘텐츠와 이미지 매핑:

```bash
python3 evaluate_website.py
```

전체 페이지, 키보드 접근, 이미지 로딩, 모바일 오버플로, 콘솔 오류:

```bash
python3 check_errors.py
```

브라우저 검사는 Codex 데스크톱의 번들 Node.js와 Playwright를 자동으로 사용하며, 사용할 수 없으면 시스템 Node.js 환경을 확인합니다.

## Content Policy

- 시간, 장소, 이동, TBC/TBD 상태는 제공된 일정 문서를 따릅니다.
- 미확정 항목은 `확정 필요`로 표시합니다.
- 장소 운영 정보는 카드의 공식 사이트 링크에서 확인합니다.
- 저장소 이름과 원격 Git 설정은 이 웹사이트 콘텐츠의 범위에 포함하지 않습니다.
