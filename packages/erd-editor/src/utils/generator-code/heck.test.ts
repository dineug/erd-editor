import { describe, expect, it } from 'vite-plus/test';

import { toSnakeCase, toUpperCamelCase } from '@/utils/generator-code/heck';

// What heck 0.5.0 itself returns for each input, so the port is held to the
// crate SeaORM's derive macros name columns and variants with.
const HECK_VECTORS: Array<[input: string, snake: string, upperCamel: string]> =
  [
    ['', '', ''],
    ['__', '', ''],
    ['_leading', 'leading', 'Leading'],
    ['trailing_', 'trailing', 'Trailing'],
    ['double__underscore', 'double_underscore', 'DoubleUnderscore'],
    ['first name', 'first_name', 'FirstName'],
    ['user-name', 'user_name', 'UserName'],
    ['user.name', 'user_name', 'UserName'],
    ['user$name', 'user_name', 'UserName'],
    ['price€', 'price', 'Price'],
    ['ID', 'id', 'Id'],
    ['ID2', 'id2', 'Id2'],
    ['userID', 'user_id', 'UserId'],
    ['UserID', 'user_id', 'UserId'],
    ['XMLHttpRequest', 'xml_http_request', 'XmlHttpRequest'],
    ['HTTPServer', 'http_server', 'HttpServer'],
    ['html5Parser', 'html5_parser', 'Html5Parser'],
    ['camelCase2Value', 'camel_case2_value', 'CamelCase2Value'],
    ['AddressLine1', 'address_line1', 'AddressLine1'],
    ['a1b2', 'a1b2', 'A1b2'],
    ['a1B2', 'a1_b2', 'A1B2'],
    ['aBC', 'a_bc', 'ABc'],
    ['ABC', 'abc', 'Abc'],
    ['UUIDv4', 'uui_dv4', 'UuiDv4'],
    ['IDs', 'i_ds', 'IDs'],
    ['IPv6Address', 'i_pv6_address', 'IPv6Address'],
    ['1st', '1st', '1st'],
    ['2fa_tokens', '2fa_tokens', '2faTokens'],
    ['Ünïcode', 'ünïcode', 'Ünïcode'],
    ['ÜNÏCODE', 'ünïcode', 'Ünïcode'],
    ['café', 'café', 'Café'],
    ['Straße', 'straße', 'Straße'],
    ['ß', 'ß', 'SS'],
    ['ΣΑΣ', 'σας', 'Σας'],
    ['İstanbul', 'i\u0307stanbul', 'İstanbul'],
    ['이름', '이름', '이름'],
    ['사용자ID', '사용자id', '사용자id'],
    ['회원Id', '회원id', '회원id'],
    ['ID카드', 'id카드', 'Id카드'],
    ['ユーザー名', 'ユーザー名', 'ユーザー名'],
    ['ИмяПользователя', 'имя_пользователя', 'ИмяПользователя'],
    ['😀', '', ''],
    ['a😀b', 'a_b', 'AB'],
    ['x²', 'x²', 'X²'],
    ['Ⅻ', 'ⅻ', 'Ⅻ'],
    ['a\u0301b', 'a_b', 'AB'],
    ['createdAt', 'created_at', 'CreatedAt'],
    ['CREATED_AT', 'created_at', 'CreatedAt'],
    ['ORDERNo', 'order_no', 'OrderNo'],
    ['self', 'self', 'Self'],
    ['type', 'type', 'Type'],
    ['r#type', 'r_type', 'RType'],
  ];

describe('heck', () => {
  it.each(HECK_VECTORS)(
    'cuts %j into the words heck 0.5 does',
    (input, snake, upperCamel) => {
      expect(toSnakeCase(input)).toBe(snake);
      expect(toUpperCamelCase(input)).toBe(upperCamel);
    }
  );
});
