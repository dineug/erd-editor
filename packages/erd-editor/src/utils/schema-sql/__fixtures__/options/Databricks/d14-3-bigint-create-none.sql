
CREATE TABLE `member`
(
  `id`    BIGINT       NOT NULL GENERATED ALWAYS AS IDENTITY,
  `email` VARCHAR(255) NOT NULL,
  CONSTRAINT `PK_member` PRIMARY KEY (`id`) NOT ENFORCED RELY
)
USING DELTA
COMMENT 'Members';

-- Databricks does not support UNIQUE constraints: `member`.`email`

CREATE TABLE `post`
(
  `id`        BIGINT       NOT NULL GENERATED ALWAYS AS IDENTITY,
  `member_id` BIGINT       NOT NULL,
  `title`     VARCHAR(200) NOT NULL,
  CONSTRAINT `PK_post` PRIMARY KEY (`id`) NOT ENFORCED RELY
)
USING DELTA;

ALTER TABLE `post`
  ADD CONSTRAINT `FK_member_TO_post`
    FOREIGN KEY (`member_id`)
    REFERENCES `member` (`id`) NOT ENFORCED RELY;

-- Databricks has no secondary indexes. `idx_post_title` on `post` (`title` ASC)
-- ALTER TABLE `post` CLUSTER BY (`title`);
