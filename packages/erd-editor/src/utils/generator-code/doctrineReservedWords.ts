/**
 * Every word DBAL 4 lists as reserved on MySQL, MariaDB, PostgreSQL, SQL
 * Server, Oracle or SQLite, in lower case: Doctrine quotes such a name in the
 * DDL it writes but in a query only when the mapping marks it with backticks.
 */
export const DOCTRINE_RESERVED_WORDS: ReadonlySet<string> = new Set(
  `
abort access accessible action add admin after all alter analyse analyze and
any array arraylen as asc asensitive asymmetric attach audit authorization
auto autoincrement backup before begin bernoulli between bigint binary blob
both break browse bulk by call cascade case cast change char character check
checkpoint close cluster clustered coalesce collate collation column comment
commit compress compute concurrently condition conflict connect constraint
contains containstable continue convert create cross cube cume_dist current
current_catalog current_date current_role current_schema current_time
current_timestamp current_user cursor database databases date day_hour
day_microsecond day_minute day_second dbcc deallocate dec decimal declare
default deferrable deferred delayed delete dense_rank deny desc describe
detach deterministic disk distinct distinctrow distributed div do double
drop dual dump each else elseif empty enclosed end errlvl escape escaped
except exclusive exec execute exists exit explain external fail false fetch
file fillfactor first_value float float4 float8 for force foreign freetext
freetexttable freeze from full fulltext function general generated get glob
goto grant group grouping groups gtids having high_priority holdlock
hour_microsecond hour_minute hour_second identified identity identity_insert
identitycol if ignore ignore_server_ids ilike immediate in increment index
indexed infile initial initially inner inout insensitive insert instead int
int1 int2 int3 int4 int8 integer intersect interval into io_after_gtids
io_before_gtids is isnull iterate join json_table key keys kill lag
last_value lateral lead leading leave left level like limit linear lineno
lines load localtime localtimestamp lock log long longblob longtext loop
low_priority manual master_bind master_heartbeat_period
master_ssl_verify_server_cert match maxextents maxvalue mediumblob mediumint
mediumtext member merge middleint minus minute_microsecond minute_second mod
mode modifies modify national natural no no_write_to_binlog noaudit
nocompress nonclustered not notfound notnull nowait nth_value ntile null
nullif number numeric of off offline offset offsets on online only open
opendatasource openquery openrowset openxml optimize optimizer_costs option
optionally or order out outer outfile over overlaps parallel parse_tree
partition pctfree percent percent_rank persist persist_only pivot placing
plan pragma precision primary print prior privileges proc procedure public
purge qualify query raise raiserror range rank raw read read_write reads
readtext real reconfigure recursive references regexp reindex release rename
repeat replace replication require resignal resource restore restrict return
returning revert revoke right rlike rollback row row_number rowcount
rowguidcol rowid rowlabel rownum rows rule s3 save savepoint schema schemas
second_microsecond securityaudit select semantickeyphrasetable
semanticsimilaritydetailstable semanticsimilaritytable sensitive separator
session session_user set setuser share show shutdown signal similar size
slow smallint some spatial specific sql sql_big_result sql_calc_found_rows
sql_small_result sqlbuf sqlexception sqlstate sqlwarning ssl start starting
statistics stored straight_join successful symmetric synonym sysdate system
system_user table tablesample temp temporary terminated textsize then
tinyblob tinyint tinytext to top trailing tran transaction trigger true
truncate try_convert tsequal uid undo union unique unlock unpivot unsigned
update updatetext usage use user using utc_date utc_time utc_timestamp
vacuum validate values varbinary varchar varchar2 varcharacter variadic
varying verbose view virtual waitfor when whenever where while window with
write writetext xor year_month zerofill
`
    .trim()
    .split(/\s+/)
);
