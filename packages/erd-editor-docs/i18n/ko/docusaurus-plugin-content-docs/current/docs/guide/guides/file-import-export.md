---
sidebar_position: 2
---

# 파일 가져오기 or 내보내기

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
