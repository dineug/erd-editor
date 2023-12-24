---
sidebar_position: 2
---

# 가이드

## 기본 사용법

편집은 마우스 오른쪽 클릭으로 컨텍스트 메뉴로 시작합니다.
<img src="/img/context-menu.png" width="400" />

### 테이블 생성

컨텍스트 메뉴 또는 단축키 `Alt + N`에서 생성 가능합니다.

### 메모 생성

컨텍스트 메뉴 또는 단축키 `Alt + M`에서 생성 가능합니다.

### 관계 생성

컨텍스트 메뉴 또는 단축키 `Ctrl + Alt + 1`에서 시작합니다.

![demo-relationship](/img/demo-relationship.webp)

## 외부 파일 가져오기

### JSON

에디터에서 정의한 스키마 형식의 파일을 가져올 수 있습니다.

<img src="/img/import-json.png" width="400" />

### Schema SQL

SQL로 정의한 스키마 파일도 가져올 수 있습니다.  
데이터베이스 벤더에 상관없이 최대한 유연하게 파서를 작성했지만 일부 지원하지 않는 문법이 있을 수 있습니다.  
[지원하는 문법은 여기에서 확인 가능합니다.](https://github.com/dineug/erd-editor/blob/main/packages/schema-sql-parser/src/schema_sql_test_case.md)

<img src="/img/import-sql.png" width="400" />

## 내보내기

내보내기 형식에는 다음과 같이 3가지를 지원하고 있습니다.

- JSON: 에디터에서 정의한 스키마 파일입니다.
- Schema SQL: 데이터베이스 벤더에 따라 문법을 생성한 스키마 파일입니다.
- PNG: 다이어그램을 이미지로 생성합니다.

<img src="/img/export-menu.png" width="400" />

## 테이블 보기 옵션

다음의 보기 옵션을 제공합니다.

- Table Comment
- Column Comment
- DataType
- Default
- Not Null
- Unique
- Auto Increment
- Relationship

![demo-view-options](/img/demo-view-options.webp)

## 테이블 위치 자동 정렬

Force Simulation으로 동작합니다.  
외부 Schema SQL 가져오고 테이블 위치 시작지점으로 활용할 수 있습니다.

![demo-automatic-table-placement](/img/demo-automatic-table-placement.webp)

## 데이터베이스

지원하는 데이터베이스는 다음과 같습니다.

- MSSQL
- MariaDB
- MySQL
- Oracle
- PostgreSQL
- SQLite

해당 옵션은 Schema SQL 문법과 DataType 자동완성을 결정합니다.

<img src="/img/database-menu.png" width="400" />

![demo-data-type-autocomplete](/img/demo-data-type-autocomplete.webp)

## 테이블 편집

기본적으로 엑셀과 동일한 사용자 편집 경험을 제공합니다.  
편집모드는 `Enter`로 시작합니다.

![demo-table-edit](/img/demo-table-edit.webp)

### Column 추가

단축키 `Alt + Enter`로 생성합니다.

### Tab 키

`Tab`으로 바로 다음 셀 편집모드로 들어갈 수 있습니다.  
마지막 셀에서는 새로운 Column을 생성합니다.  
`Shift + Tab`으로 이전 셀 편집모드로 이동합니다.

![demo-table-tab](/img/demo-table-tab.webp)

### Column 다중 선택

4가지 방법을 지원하고 있습니다.

- `Shift + Arrow Up/Down`
- `Ctrl + Click`
- `Shift + Click`
- `Alt + A`: 전체 선택

![demo-column-select](/img/demo-column-select.webp)

### Column 순서 변경 및 이동

`drag`시 동작하며 다른 테이블로 이동할 수 있습니다.

![demo-column-move](/img/demo-column-move.webp)

`Ctrl + drag`로 다중 컬럼 이동도 지원합니다.

![demo-column-multi-move](/img/demo-column-multi-move.webp)

### Column 삭제

현재 선택된 column를 삭제합니다.  
단축키 `Alt + Backspace` or `Alt + Delete`

![demo-column-remove](/img/demo-column-remove.webp)

### Column 복사/붙여넣기

테이블 형식의 클립보드로 동작합니다.  
단축키 `Ctrl + C`, `Ctrl + V`

에디터에서 엑셀로 붙여넣거나  
엑셀에서 에디터로 붙여넣기 가능합니다.  
단 특정 컬럼의 경우 true/false는 다음과 같이 지원합니다.  
대소문자 구분하지 않음

- AutoIncrement: `TRUE`, `1`, `YES`, `Y`
- Unique: `TRUE`, `1`, `YES`, `Y`
- NotNull: `TRUE`, `1`, `YES`, `Y`, `NOT NULL`

![demo-copy-column-to-sheet](/img/demo-copy-column-to-sheet.webp)
![demo-copy-sheet-column](/img/demo-copy-sheet-column.webp)

테이블 다중선택시 동작도 지원합니다.

![demo-copy-column-multi](/img/demo-copy-column-multi.webp)

### Column Primary Key

테이블 컨텍스트 메뉴 또는 단축키 `Alt + K`로 가능합니다.

![demo-column-pk](/img/demo-column-pk.webp)

## 다중 선택

3가지 방법을 지원하고 있습니다.

- `Ctrl + drag`
- `Ctrl + click`
- `Ctrl + Alt + A`

![demo-table-select](/img/demo-table-select.webp)

## 테이블, 메모 삭제

현재 선택된 테이블, 메모를 삭제합니다.  
단축키 `Ctrl + Backspace` or `Ctrl + Delete`

![demo-table-remove](/img/demo-table-remove.webp)

## 줌 축소/확대

기본적으로 마우스 휠로 동작합니다.  
단축키 `Ctrl + Plus`, `Ctrl + Minus`

![demo-zoom](/img/demo-zoom.webp)

## 관계 편집

### 삭제

관계 컨텍스트 메뉴를 통해 삭제가능합니다.

<img src="/img/relationship-remove.png" width="400" />

### 타입 변경

관계 컨텍스트 메뉴를 통해 변경가능합니다.

<img src="/img/relationship-type.png" width="400" />

## 테이블, 메모 컬러 지정

카테고리별로 구분하기위해 컬러를 지정할 수 있습니다.

![demo-table-color](/img/demo-table-color.webp)

## 빠른 검색

특정 기능을 사용하거나 테이블를 찾기위해 사용가능합니다.  
단축키 `Ctrl + K`
![demo-quick-search](/img/demo-quick-search.webp)

## 시각화

테이블간에 관계를 통해 핵심 도메인을 확인할 수 있습니다.

![demo-visualization](/img/demo-visualization.webp)

## Undo, Redo

편집 이전과 앞전 상태로 돌아갈 수 있습니다.  
히스토리 최대 크기는 `2048`개 변경사항을 기록합니다.

- Undo: `Ctrl + Z`
- Redo: `Ctrl + Shift + Z`

## 설정

### 관계 데이터 타입 동기화

데이터 타입 동기화여부를 결정합니다.

![demo-relationship-data-type-sync](/img/demo-relationship-data-type-sync.webp)

### 코멘트 최대 크기

코멘트의 최대 크기를 지정합니다.

<img src="/img/settings-comment-width.png" width="400" />
<img src="/img/settings-comment-width-2.png" width="400" />

### 컬럼 순서 조정

테이블에 표출되는 컬럼 순서를 설정합니다.

![demo-settings-column-order](/img/demo-settings-column-order.webp)
