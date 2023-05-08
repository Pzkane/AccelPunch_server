const http = require('http');
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config();

const hostname = '0.0.0.0';
const port = 3000;

class Connection {
  constructor() {
    this.pool = new Pool({
      user: process.env.PGUSER,
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      password: process.env.PGPASSWORD,
      port: process.env.PGPORT,
    });
  }
  
  query = async (query) => {
    try {
      await this.pool.connect()
      const res = await this.pool.query(query)
      // console.log(res)
      // await this.pool.end()
    } catch (error) {
      console.log(error)
    }
  }
};

let conn = new Connection();

const server = http.createServer((req, res) => {
  let op = "GET";
  if( req.method === 'GET' ) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Connected\n');
  } else if( req.method === 'POST' ) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Connected\n');
    op = "POST";
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const json_str = Buffer.concat(chunks);
      const json = JSON.parse(json_str);
      // console.log(JSON.stringify(json, null, 2));
      // console.log(json.gloves.length);
      stmt = "INSERT INTO ";
      let recordCount = 0;
      if (json.hasOwnProperty("gloves")) {
        stmt += "gloves (timestamp, glove, x, y, z) VALUES "
        json.gloves.forEach(glove => {
          if (recordCount > 0) {
            stmt += ","
          }
          stmt += "(" +
                    glove.timestamp + "," +
                    "'"+glove.glove+"'" + "," +
                    glove.x + "," +
                    glove.y + "," +
                    glove.z + ")";
          recordCount++;
        });
      } else if (json.hasOwnProperty("bag")) {
        stmt += "bag (timestamp, x, y, z, temperature) VALUES "
        json.bag.forEach(bagRecord => {
          if (recordCount > 0) {
            stmt += ","
          }
          stmt += "(" +
                    bagRecord.timestamp + "," +
                    bagRecord.x + "," +
                    bagRecord.y + "," +
                    bagRecord.z + "," +
                    bagRecord.temperature + ")";
          recordCount++;
        });
      }
      // console.log(stmt);
      stmt += " ON CONFLICT DO NOTHING";
      conn.query(stmt);
    })
  }
  console.log(`${op} from ${req.socket.remoteAddress}`);
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
