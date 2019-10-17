import { DataTypeHint } from '../dataType'

const MySQLTypes: DataTypeHint[] = [
  { name: 'BLOB' },
  { name: 'BINARY' },
  { name: 'LONGBLOB' },
  { name: 'MEDIUMBLOB' },
  { name: 'TINYBLOB' },
  { name: 'VARBINARY' },

  { name: 'DATE' },
  { name: 'DATETIME' },
  { name: 'TIME' },
  { name: 'TIMESTAMP' },
  { name: 'YEAR' },

  { name: 'GEOMETRY' },
  { name: 'GEOMETRYCOLLECTION' },
  { name: 'LINESTRING' },
  { name: 'MULTILINESTRING' },
  { name: 'MULTIPOINT' },
  { name: 'MULTIPOLYGON' },
  { name: 'POINT' },
  { name: 'POLYGON' },

  { name: 'BIGINT' },
  { name: 'DECIMAL' },
  { name: 'DOUBLE' },
  { name: 'FLOAT' },
  { name: 'INT' },
  { name: 'MEDIUMINT' },
  { name: 'REAL' },
  { name: 'SMALLINT' },
  { name: 'TINYINT' },

  { name: 'CHAR' },
  { name: 'JSON' },
  { name: 'NCHAR' },
  { name: 'NVARCHAR' },
  { name: 'VARCHAR' },

  { name: 'LONGTEXT' },
  { name: 'MEDIUMTEXT' },
  { name: 'TEXT' },
  { name: 'TINYTEXT' },

  { name: 'BIT' },
  { name: 'BOOLEAN' },
  { name: 'ENUM' },
  { name: 'SET' }
]

export default MySQLTypes
