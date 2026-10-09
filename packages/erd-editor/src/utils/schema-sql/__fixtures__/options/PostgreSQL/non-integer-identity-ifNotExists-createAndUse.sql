
CREATE SCHEMA IF NOT EXISTS shop;
SET search_path TO shop, public;

CREATE TABLE IF NOT EXISTS member
(
  id    UUID         NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  PRIMARY KEY (id)
);

-- PostgreSQL takes IDENTITY only on smallint, integer or bigint, so member.id is written without it.

COMMENT ON TABLE member IS 'Members';

CREATE TABLE IF NOT EXISTS post
(
  id        INT          NOT NULL GENERATED ALWAYS AS IDENTITY,
  member_id UUID         NOT NULL,
  title     VARCHAR(200) NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE post DROP CONSTRAINT IF EXISTS FK_member_TO_post;
ALTER TABLE post
  ADD CONSTRAINT FK_member_TO_post
    FOREIGN KEY (member_id)
    REFERENCES member (id)
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_post_title
  ON post (title ASC);
