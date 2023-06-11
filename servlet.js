require('chartjs-adapter-moment');
const http = require('http');
const fs = require('fs')
const { Pool } = require("pg");
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
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
    this.client = null;
  }
  
  query = async (query) => {
    try {
      this.client = await this.pool.connect();
      const res = await this.pool.query(query);
      return res;
    } catch (error) {
      console.log(error);
    }
  }

  close = () => {
    this.client.release();
  }
};

const width = 1920; //px
const height = 1080; //px
const backgroundColour = 'white'; // Uses https://www.w3schools.com/tags/canvas_fillstyle.asp
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour});

let data_L;
let data_R;
let data_bag;

async function updateCharts() {
  let query_dataset_L = `
  WITH _gloves as (
    select DISTINCT
      timestamp,
      TO_CHAR(TO_TIMESTAMP(timestamp::double precision/1000), 'YYYY-DD-MM HH24:MI:SS.MS') as datetime,
      glove,
      x+y+z g
    from gloves
    order by timestamp
  )
  select datetime x, g y, glove
  from _gloves
  where glove = 'L' and TO_TIMESTAMP(timestamp::double precision/1000) >= now() - interval '3 hours';
  `;
  let query_dataset_R = `
  WITH _gloves as (
    select DISTINCT
      timestamp,
      TO_CHAR(TO_TIMESTAMP(timestamp::double precision/1000), 'YYYY-DD-MM HH24:MI:SS.MS') as datetime,
      glove,
      x+y+z g
    from gloves
    order by timestamp
  )
  select datetime x, g y, glove
  from _gloves
  where glove = 'R' and TO_TIMESTAMP(timestamp::double precision/1000) >= now() - interval '3 hours';
  `;
  let query_dataset_bag = `
  WITH _bag as (
    select DISTINCT
      timestamp,
      TO_CHAR(TO_TIMESTAMP(timestamp::double precision/1000), 'YYYY-DD-MM HH24:MI:SS.MS') as datetime,
      x+y+z g
    from bag
    order by timestamp
  )
  select datetime x, g y
  from _bag
  where TO_TIMESTAMP(timestamp::double precision/1000) >= now() - interval '3 hours';
  `;
  let conn = new Connection();
  const result_L = await conn.query(query_dataset_L);
  const result_R = await conn.query(query_dataset_R);
  const result_bag = await conn.query(query_dataset_bag);
  conn.close();
  data_L = result_L.rows;
  data_R = result_R.rows;
  data_bag = result_bag.rows;
  const dataset_max_xL = data_L.length ? data_L.reduce(function(prev, current) {
    return (new Date(prev) > new Date(current.x)) ? new Date(prev) : current.x
  }) : 0;
  const dataset_max_xR = data_R.length ? data_R.reduce(function(prev, current) {
    return (new Date(prev) > new Date(current.x)) ? new Date(prev) : current.x
  }) : 0;
  const dataset_max_yL = data_L.length ? data_L.reduce(function(prev, current) {
    return (prev > current.y) ? prev : current.y
  }) : 0;
  const dataset_max_yR = data_R.length ? data_R.reduce(function(prev, current) {
    return (prev > current.y) ? prev : current.y
  }) : 0;
  const x_dataset_max_date = dataset_max_xL > dataset_max_xR ? dataset_max_xL : dataset_max_xR;
  const y_dataset_max_length = dataset_max_yL > dataset_max_yR ? dataset_max_yL : dataset_max_yR;
  console.log("Datasets received");

  const config_L = {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Left Hand',
          data: data_L,
          borderColor: 'rgb(18, 56, 224)',
        },
        {
          label: 'Right Hand',
          data: data_R,
          borderColor: 'rgb(255, 51, 51)',
        },
        {
          label: 'Bag Hits',
          data: data_bag,
          borderColor: 'rgb(24, 240, 81)',
        },
      ]
    },
    plugins: {
      legend: {
        position: 'top',
      },
    },
    options: {
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'minute'
          },
          max: x_dataset_max_date
        },
        y: {
          max: y_dataset_max_length + 500
        }
      }
    }
  }

  const image = chartJSNodeCanvas.renderToBuffer(config_L);
  image.then((res_buf) => {
    fs.writeFile('gloves.jpg', res_buf, function(err, written) {
      if(err)
        console.log(err);
      else
        console.log("Image successfully written");
    });
  })

}

function calculatePunchSpeed(shadow_dataset) {
  let last_element = null
  let fastest_delta = Number.MAX_VALUE;
  let fastest_punch = null;
  for (let i = 0; i < shadow_dataset.length; i++) {
    const element = shadow_dataset[i];
    if (last_element == null) {
      last_element = element;
    } else {
      let delta_time = new Date(element.x).getTime() - new Date(last_element.x).getTime();
      if (delta_time < fastest_delta) {
        fastest_delta = delta_time;
        fastest_punch = element;
      }
    }
  }

  return {
    speed_mps: fastest_punch ? (fastest_punch.y/1000) * 9.81 * (fastest_delta/1000) : 0,
    punch: fastest_punch ? fastest_punch : {x:'0', y:0, glove:''}
  }
}

function calculatePunchStats(data_left, data_right, _data_bag) {
  // Strongest hit overall
  const max_hit_L = data_left.length ? data_left.reduce(function(prev, current) {
    return (prev.y > current.y) ? prev : current
  }) : {x:'0', y:0, glove:''};
  const max_hit_R = data_right.length ? data_right.reduce(function(prev, current) {
    return (prev.y > current.y) ? prev : current
  }) : {x:'0', y:0, glove:''};

  // Strongest hit during shadowboxing
  // 1. Flatten all 3 datasets into 1 timeline
  let timeline = data_left.concat(_data_bag, data_right);
  // 2. Sort timeline
  timeline = timeline.sort((prev, current) => {
    return new Date(prev.x) - new Date(current.x);
  })
  // 3. Determine boxing windows on a bag
  let start_bag_record = null;
  let latest_bag_record = null;
  let boxing_dataset = [];
  for (let i = 0; i < timeline.length; i++) {
    const dataset_el = timeline[i];
    if (!dataset_el.hasOwnProperty('glove')) {
      if (start_bag_record == null) {
        start_bag_record = latest_bag_record = dataset_el;
      } else {
        latest_bag_record = dataset_el;
      }
    } else {
      if (start_bag_record != null) {
        if (new Date(dataset_el.x).getTime() - new Date(latest_bag_record.x).getTime() < 1000) {
          boxing_dataset.push(dataset_el);
        } else {
          start_bag_record = latest_bag_record = null;
        }
      }
    }
  }
  // 4. Exclude boxing on bag entries from timeline
  let shadow_timeline = timeline.filter((el) => !boxing_dataset.map((f) => f.x).includes(el.x));
  // 5. Exclude also bag entries
  shadow_timeline = shadow_timeline.length ? shadow_timeline.filter((el) => el.hasOwnProperty('glove')) : [];
  // 6. Get our data
  const shadow_timeline_L = shadow_timeline.length ? shadow_timeline.filter((el) => el.glove == 'L') : 0;
  const shadow_timeline_R = shadow_timeline.length ? shadow_timeline.filter((el) => el.glove == 'R') : 0;
  const timeline_L = timeline.length ? timeline.filter((el) => el.glove == 'L') : 0;
  const timeline_R = timeline.length ? timeline.filter((el) => el.glove == 'R') : 0;
  let strongest_left = shadow_timeline_L.length ? shadow_timeline_L.reduce(function(prev, current) {
    return (prev.y > current.y) ? prev : current
  }) : {x:'0', y:0, glove:''};
  let strongest_right = shadow_timeline_R.length ? shadow_timeline_R.reduce(function(prev, current) {
    return (prev.y > current.y) ? prev : current
  }) : {x:'0', y:0, glove:''};

  // Strongest hit on a bag
  const max_hit_bag = _data_bag.length ? _data_bag.reduce(function(prev, current) {
    return (prev.y > current.y) ? prev : current
  }) : {x:'0', y:0};

  return {
    strongest_left: max_hit_L,
    strongest_right: max_hit_R,
    fastest_left: calculatePunchSpeed(timeline_L),
    fastest_right: calculatePunchSpeed(timeline_R),
    bag: max_hit_bag,
    shadow: {
      strongest_left,
      strongest_right,
      fastest_left: calculatePunchSpeed(shadow_timeline_L),
      fastest_right: calculatePunchSpeed(shadow_timeline_R),
    }
  }
}

async function updateStats() {
  let query_dataset_L = `
  WITH _gloves as (
    select DISTINCT
      timestamp,
      TO_CHAR(TO_TIMESTAMP(timestamp::double precision/1000), 'YYYY-DD-MM HH24:MI:SS.MS') as datetime,
      glove,
      x+y+z g
    from gloves
    order by timestamp
  )
  select datetime x, g y, glove
  from _gloves
  where glove = 'L';
  `;
  let query_dataset_R = `
  WITH _gloves as (
    select DISTINCT
      timestamp,
      TO_CHAR(TO_TIMESTAMP(timestamp::double precision/1000), 'YYYY-DD-MM HH24:MI:SS.MS') as datetime,
      glove,
      x+y+z g
    from gloves
    order by timestamp
  )
  select datetime x, g y, glove
  from _gloves
  where glove = 'R';
  `;
  let query_dataset_bag = `
  WITH _bag as (
    select DISTINCT
      timestamp,
      TO_CHAR(TO_TIMESTAMP(timestamp::double precision/1000), 'YYYY-DD-MM HH24:MI:SS.MS') as datetime,
      x+y g
    from bag
    order by timestamp
  )
  select datetime x, g y
  from _bag;
  `;
  let conn = new Connection();
  const result_L = await conn.query(query_dataset_L);
  const result_R = await conn.query(query_dataset_R);
  const result_bag = await conn.query(query_dataset_bag);
  conn.close();
  let data_L_all = result_L.rows;
  let data_R_all = result_R.rows;
  let data_bag_all = result_bag.rows;
  stats = {
    hour: calculatePunchStats(data_L, data_R, data_bag),
    overall: calculatePunchStats(data_L_all, data_R_all, data_bag_all)
  }
  console.log("Stats ready");
  return stats;
}

const server = http.createServer((req, res) => {
  let op = "GET";
  // Just ping from the client, answer with success
  if( req.method === 'GET' ) {
    console.log("Incoming GET");
    res.writeHead(200, {'Content-Type': 'text/plain'});
    updateCharts().then(() => {
      const promise_stats = updateStats();
      promise_stats.then((stats) => {
        res.end(JSON.stringify({
          status: 200,
          data: stats
        }));
      })
    })
  // POSTing results here, process
  } else if( req.method === 'POST' ) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(JSON.stringify({
      status: 200
    }));
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
      let conn = new Connection();
      conn.query(stmt).then(() => {
        conn.close();
        updateCharts();
      });
    })
  }
  console.log(`${op} from ${req.socket.remoteAddress}`);
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
