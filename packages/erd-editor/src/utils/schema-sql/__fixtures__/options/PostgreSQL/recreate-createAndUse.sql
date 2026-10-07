
CREATE SCHEMA IF NOT EXISTS shop;
SET search_path TO shop, public;

DROP TABLE IF EXISTS shop.member, shop.post;

CREATE TABLE member
(
  id    INT          NOT NULL GENERATED ALWAYS AS IDENTITY,
  email VARCHAR(255) NOT NULL UNIQUE,
  PRIMARY KEY (id)
);

COMMENT ON TABLE member IS 'Members';

CREATE TABLE post
(
  id        INT          NOT NULL GENERATED ALWAYS AS IDENTITY,
  member_id INT          NOT NULL,
  title     VARCHAR(200) NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE post
  ADD CONSTRAINT FK_member_TO_post
    FOREIGN KEY (member_id)
    REFERENCES member (id)
    ON DELETE CASCADE;

CREATE INDEX idx_post_title
  ON post (title ASC);
