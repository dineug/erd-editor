
CREATE TABLE member_notification_settings
(
  id    INT          NOT NULL,
  email VARCHAR(255) NOT NULL,
  CONSTRAINT PK_member_notification_settings PRIMARY KEY (id)
);

ALTER TABLE member_notification_settings
  ADD CONSTRAINT UQ_member_notification_settings_email UNIQUE (email);

CREATE SEQUENCE SEQ_member_notification_settings
START WITH 1
INCREMENT BY 1;

CREATE OR REPLACE TRIGGER SEQ_TRG_member_notification_settings
BEFORE INSERT ON member_notification_settings
REFERENCING NEW AS NEW FOR EACH ROW
BEGIN
  SELECT SEQ_member_notification_settings.NEXTVAL
  INTO :NEW.id
  FROM DUAL;
END;
/

COMMENT ON TABLE member_notification_settings IS 'Members';

CREATE TABLE post
(
  id        INT          NOT NULL,
  member_id INT          NOT NULL,
  title     VARCHAR(200) NOT NULL,
  CONSTRAINT PK_post PRIMARY KEY (id)
);

CREATE SEQUENCE SEQ_post
START WITH 1
INCREMENT BY 1;

CREATE OR REPLACE TRIGGER SEQ_TRG_post
BEFORE INSERT ON post
REFERENCING NEW AS NEW FOR EACH ROW
BEGIN
  SELECT SEQ_post.NEXTVAL
  INTO :NEW.id
  FROM DUAL;
END;
/

ALTER TABLE post
  ADD CONSTRAINT FK_member_notification_settings_TO_post
    FOREIGN KEY (member_id)
    REFERENCES member_notification_settings (id)
    ON DELETE CASCADE;

CREATE INDEX idx_post_title
  ON post (title ASC);
