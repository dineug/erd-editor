
SET TIME ZONE 'UTC';

CREATE TABLE `member`
(
  `id`    INT          NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  CONSTRAINT `PK_member` PRIMARY KEY (`id`) NOT ENFORCED RELY
)
USING DELTA
COMMENT 'Members';

-- Databricks takes IDENTITY only on BIGINT, so `member`.`id` is written without it.

-- Databricks does not support UNIQUE constraints: `member`.`email`

CREATE TABLE `post`
(
  `id`        INT          NOT NULL,
  `member_id` INT          NOT NULL,
  `title`     VARCHAR(200) NOT NULL,
  CONSTRAINT `PK_post` PRIMARY KEY (`id`) NOT ENFORCED RELY
)
USING DELTA;

-- Databricks takes IDENTITY only on BIGINT, so `post`.`id` is written without it.

ALTER TABLE `post`
  ADD CONSTRAINT `FK_member_TO_post`
    FOREIGN KEY (`member_id`)
    REFERENCES `member` (`id`) NOT ENFORCED RELY;

-- Databricks has no secondary indexes. `idx_post_title` on `post` (`title` ASC)
-- ALTER TABLE `post` CLUSTER BY (`title`);

ALTER TABLE `post` CLUSTER BY (`member_id`);
