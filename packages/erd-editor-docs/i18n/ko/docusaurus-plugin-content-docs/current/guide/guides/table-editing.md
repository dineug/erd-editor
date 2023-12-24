---
sidebar_position: 3
---

# 테이블 편집

기본적으로 엑셀과 동일한 사용자 편집 경험을 제공합니다.  
편집모드는 `Enter`로 시작합니다.

![demo-table-edit](/img/demo-table-edit.webp)

## Column 추가

단축키 `Alt + Enter`로 생성합니다.

## Tab 키

`Tab`으로 바로 다음 셀 편집모드로 들어갈 수 있습니다.  
마지막 셀에서는 새로운 Column을 생성합니다.  
`Shift + Tab`으로 이전 셀 편집모드로 이동합니다.

![demo-table-tab](/img/demo-table-tab.webp)

## Column 다중 선택

4가지 방법을 지원하고 있습니다.

- `Shift + Arrow Up/Down`
- `Ctrl + Click`
- `Shift + Click`
- `Alt + A`: 전체 선택

![demo-column-select](/img/demo-column-select.webp)

## Column 순서 변경 및 이동

`drag`시 동작하며 다른 테이블로 이동할 수 있습니다.

![demo-column-move](/img/demo-column-move.webp)

`Ctrl + drag`로 다중 컬럼 이동도 지원합니다.

![demo-column-multi-move](/img/demo-column-multi-move.webp)

## Column 삭제

현재 선택된 column를 삭제합니다.  
단축키 `Alt + Backspace` or `Alt + Delete`

![demo-column-remove](/img/demo-column-remove.webp)

## Column 복사/붙여넣기

테이블 형식의 클립보드로 동작합니다.  
단축키 `Ctrl + C`, `Ctrl + V`

에디터에서 엑셀로 붙여넣거나  
엑셀에서 에디터로 붙여넣기 가능합니다.  
단 특정 컬럼의 경우 true/false는 다음과 같이 지원합니다.  
대소문자 구분하지 않음

- AutoIncrement: `TRUE`, `1`, `YES`, `Y`
- Unique: `TRUE`, `1`, `YES`, `Y`
- Not Null: `TRUE`, `1`, `YES`, `Y`, `NOT NULL`

![demo-copy-column-to-sheet](/img/demo-copy-column-to-sheet.webp)
![demo-copy-sheet-column](/img/demo-copy-sheet-column.webp)

테이블 다중선택시 동작도 지원합니다.

![demo-copy-column-multi](/img/demo-copy-column-multi.webp)

## Column Primary Key

테이블 컨텍스트 메뉴 또는 단축키 `Alt + K`로 가능합니다.

![demo-column-pk](/img/demo-column-pk.webp)
