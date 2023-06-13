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

const glovesFN = 'gloves.jpg';
const gloves_hourFN = 'gloves_hour.jpg';

let data_L;
let data_R;
let data_bag;
let data_L_all;
let data_R_all;
let data_bag_all;

async function updateCharts(stats) {
  const dataset_max_xL_h = data_L.length ? data_L.reduce(function(prev, current) {
    return (new Date(Date.parse(prev)) > new Date(Date.parse(current.x))) ? new Date(Date.parse(prev)) : current.x
  }) : 0;
  const dataset_max_xR_h = data_R.length ? data_R.reduce(function(prev, current) {
    return (new Date(Date.parse(prev)) > new Date(Date.parse(current.x))) ? new Date(Date.parse(prev)) : current.x
  }) : 0;
  const dataset_max_xBag_h = data_bag.length ? data_bag.reduce(function(prev, current) {
    return (new Date(Date.parse(prev)) > new Date(Date.parse(current.x))) ? new Date(Date.parse(prev)) : current.x
  }) : 0;
  const dataset_max_yL_h = data_L.length ? data_L.reduce(function(prev, current) {
    return (prev > current.y) ? prev : current.y
  }) : 0;
  const dataset_max_yR_h = data_R.length ? data_R.reduce(function(prev, current) {
    return (prev > current.y) ? prev : current.y
  }) : 0;
  const dataset_max_xBag = data_bag_all.length ? data_bag_all.reduce(function(prev, current) {
    return (new Date(Date.parse(prev)) > new Date(Date.parse(current.x))) ? new Date(Date.parse(prev)) : current.x
  }) : 0;
  const dataset_max_xL = data_L_all.length ? data_L_all.reduce(function(prev, current) {
    return (new Date(Date.parse(prev)) > new Date(Date.parse(current.x))) ? new Date(Date.parse(prev)) : current.x
  }) : 0;
  const dataset_max_xR = data_R_all.length ? data_R_all.reduce(function(prev, current) {
    return (new Date(Date.parse(prev)) > new Date(Date.parse(current.x))) ? new Date(Date.parse(prev)) : current.x
  }) : 0;
  const dataset_max_yL = data_L_all.length ? data_L_all.reduce(function(prev, current) {
    return (prev > current.y) ? prev : current.y
  }) : 0;
  const dataset_max_yR = data_R_all.length ? data_R_all.reduce(function(prev, current) {
    return (prev > current.y) ? prev : current.y
  }) : 0;
  const x_dataset_max_date_h = dataset_max_xL_h > dataset_max_xR_h ? dataset_max_xL_h : dataset_max_xR_h;
  const y_dataset_max_length_h = dataset_max_yL_h > dataset_max_yR_h ? dataset_max_yL_h : dataset_max_yR_h;
  const x_dataset_max_date = dataset_max_xL > dataset_max_xR ? dataset_max_xL : dataset_max_xR;
  const y_dataset_max_length = dataset_max_yL > dataset_max_yR ? dataset_max_yL : dataset_max_yR;
  console.log("Datasets received");

  const config_hour = {
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
        {
          type: 'bar',
          label: 'Max force (L)',
          data: [
            { x: stats.hour.force_max_left.x, y: stats.hour.force_max_left.y },
            // Add 2 minutes to bar display
            { x: new Date(Date.parse(stats.hour.force_max_left.x)).setMinutes(new Date(Date.parse(stats.hour.force_max_left.x)).getMinutes() + 10), y: 0 }
          ],
          backgroundColor: 'rgba(18, 56, 224, 0.2)'
        },
        {
          type: 'bar',
          label: 'Max force (R)',
          data: [
            { x: stats.hour.force_max_right.x, y: stats.hour.force_max_right.y },
            // Add 2 minutes to bar display
            { x: new Date(Date.parse(stats.hour.force_max_right.x)).setMinutes(new Date(Date.parse(stats.hour.force_max_right.x)).getMinutes() + 10), y: 0 }
          ],
          backgroundColor: 'rgba(255, 51, 51, 0.2)'
        }
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
        },
      }
    }
  }

  let config = {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Left Hand',
          data: data_L_all,
          borderColor: 'rgb(18, 56, 224)',
        },
        {
          label: 'Right Hand',
          data: data_R_all,
          borderColor: 'rgb(255, 51, 51)',
        },
        {
          label: 'Bag Hits',
          data: data_bag_all,
          borderColor: 'rgb(24, 240, 81)',
        },
        {
          type: 'bar',
          label: 'Max force (L)',
          data: [
            { x: stats.overall.force_max_left.x, y: stats.overall.force_max_left.y },
            { x: new Date(Date.parse(stats.overall.force_max_left.x)).setMinutes(new Date(Date.parse(stats.overall.force_max_left.x)).getMinutes() + 10), y: 0 }
          ],
          backgroundColor: 'rgba(18, 56, 224, 0.2)'
        },
        {
          type: 'bar',
          label: 'Max force (R)',
          data: [
            { x: stats.overall.force_max_right.x, y: stats.overall.force_max_right.y },
            { x: new Date(Date.parse(stats.overall.force_max_right.x)).setMinutes(new Date(Date.parse(stats.overall.force_max_right.x)).getMinutes() + 10), y: 0 }
          ],
          backgroundColor: 'rgba(255, 51, 51, 0.2)'
        }
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
        },
      }
    }
  }

  if (stats.overall.bag.y != 0) {
    config.data.datasets.push(
      {
        type: 'bar',
        label: 'Max force (Bag)',
        data: [
          { x: stats.overall.bag.x, y: stats.overall.bag.y },
          { x: new Date(stats.overall.bag.x).setMinutes(new Date(stats.overall.bag.x).getMinutes() + 10), y: 0 }
        ],
        backgroundColor: 'rgba(24, 240, 81, 0.2)'
      }
    )
  }

  if (stats.hour.bag.y != 0) {
    config_hour.data.datasets.push(
      {
        type: 'bar',
        label: 'Max force (Bag)',
        data: [
          { x: stats.hour.bag.x, y: stats.hour.bag.y },
          { x: new Date(stats.hour.bag.x).setMilliseconds(new Date(stats.hour.bag.x).setMilliseconds() + 10), y: 0 }
        ],
        backgroundColor: 'rgba(24, 240, 81, 0.2)'
      }
    )
  }

  const image_gloves_hour = chartJSNodeCanvas.renderToBuffer(config_hour);
  const image_gloves_overall = chartJSNodeCanvas.renderToBuffer(config);
  image_gloves_hour.then((res_buf) => {
    fs.writeFile(gloves_hourFN, res_buf, function(err, written) {
      if(err)
        console.log(err);
      else
        console.log("Image successfully written (hourly)");
    });
  })
  image_gloves_overall.then((res_buf) => {
    fs.writeFile(glovesFN, res_buf, function(err, written) {
      if(err)
        console.log(err);
      else
        console.log("Image successfully written");
    });
  })

  return stats;
}

function calculatePunchSpeed(shadow_dataset) {
  let last_element = null
  let fastest_delta = Number.MAX_VALUE;
  let fastest_punch = null;
  for (let i = 0; i < shadow_dataset.length; i++) {
    const element = shadow_dataset[i];
    if (last_element != null) {
      let delta_time = new Date(Date.parse(element.x)).getTime() - new Date(Date.parse(last_element.x)).getTime();
      if (delta_time < fastest_delta) {
        fastest_delta = delta_time;
        fastest_punch = element;
      }
    }
    last_element = element;
  }
  console.log(fastest_punch, fastest_delta);
  return {
    speed_ms: fastest_punch ? fastest_delta : 0,
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
  // Average hit overall
  const avg_hit_L = data_left.length ? Math.round((data_left.reduce((total, next) => total + next.y, 0) / data_left.length) * 100) / 100 : 0;
  const avg_hit_R = data_right.length ? Math.round((data_right.reduce((total, next) => total + next.y, 0) / data_right.length) * 100) / 100 : 0;

  // Strongest hit on a bag
  const max_hit_bag = _data_bag.length ? _data_bag.reduce(function(prev, current) {
    return (prev.y > current.y) ? prev : current
  }) : {x:'0', y:0};
  
  // Strongest hit during shadowboxing
  // 1. Flatten all 3 datasets into 1 timeline
  let timeline = data_left.concat(_data_bag, data_right);
  // 2. Sort timeline
  timeline = timeline.sort((prev, current) => {
    return new Date(Date.parse(prev.x)) - new Date(Date.parse(current.x));
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
        if (new Date(Date.parse(dataset_el.x)).getTime() - new Date(Date.parse(latest_bag_record.x)).getTime() < 1000) {
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
  let force_max_left = shadow_timeline_L.length ? shadow_timeline_L.reduce(function(prev, current) {
    return (prev.y > current.y) ? prev : current
  }) : {x:'0', y:0, glove:''};
  let force_max_right = shadow_timeline_R.length ? shadow_timeline_R.reduce(function(prev, current) {
    return (prev.y > current.y) ? prev : current
  }) : {x:'0', y:0, glove:''};
  const force_avg_left = shadow_timeline_L.length ? Math.round((shadow_timeline_L.reduce((total, next) => total + next.y, 0) / shadow_timeline_L.length) * 100) / 100 : 0;
  const force_avg_right = shadow_timeline_R.length ? Math.round((shadow_timeline_R.reduce((total, next) => total + next.y, 0) / shadow_timeline_R.length) * 100) / 100 : 0;

  return {
    force_max_left: max_hit_L,
    force_max_right: max_hit_R,
    force_avg_left: avg_hit_L,
    force_avg_right: avg_hit_R,
    fastest_left: calculatePunchSpeed(timeline_L),
    fastest_right: calculatePunchSpeed(timeline_R),
    bag: max_hit_bag,
    shadow: {
      force_max_left,
      force_max_right,
      force_avg_left,
      force_avg_right,
      fastest_left: calculatePunchSpeed(shadow_timeline_L),
      fastest_right: calculatePunchSpeed(shadow_timeline_R),
    }
  }
}

async function updateStats() {
  let query_dataset_L_hour = `
  WITH _gloves as (
    select DISTINCT
      timestamp,
      TO_CHAR(TO_TIMESTAMP(timestamp::double precision/1000), 'YYYY-MM-DD HH24:MI:SS.MS+03:00') as datetime,
      glove,
      x+y+z g
    from gloves
    order by timestamp
  )
  select datetime x, g y, glove
  from _gloves
  where glove = 'L' and TO_TIMESTAMP(timestamp::double precision/1000) >= now() - interval '2 hour' and g > 0;
  `;
  let query_dataset_R_hour = `
  WITH _gloves as (
    select DISTINCT
      timestamp,
      TO_CHAR(TO_TIMESTAMP(timestamp::double precision/1000), 'YYYY-MM-DD HH24:MI:SS.MS+03:00') as datetime,
      glove,
      x+y+z g
    from gloves
    order by timestamp
  )
  select datetime x, g y, glove
  from _gloves
  where glove = 'R' and TO_TIMESTAMP(timestamp::double precision/1000) >= now() - interval '2 hour' and g > 0;
  `;
  let query_dataset_bag_hour = `
  WITH _bag as (
    select DISTINCT
      timestamp,
      TO_CHAR(TO_TIMESTAMP(timestamp::double precision/1000), 'YYYY-MM-DD HH24:MI:SS.MS+03:00') as datetime,
      x+y g
    from bag
    order by timestamp
  )
  select datetime x, g y
  from _bag
  where TO_TIMESTAMP(timestamp::double precision/1000) >= now() - interval '2 hour' and g > 0;
  `;

  let query_dataset_L = `
  WITH _gloves as (
    select DISTINCT
      timestamp,
      TO_CHAR(TO_TIMESTAMP(timestamp::double precision/1000), 'YYYY-MM-DD HH24:MI:SS.MS+03:00') as datetime,
      glove,
      x+y+z g
    from gloves
    order by timestamp
  )
  select datetime x, g y, glove
  from _gloves
  where glove = 'L' and g > 0;
  `;
  let query_dataset_R = `
  WITH _gloves as (
    select DISTINCT
      timestamp,
      TO_CHAR(TO_TIMESTAMP(timestamp::double precision/1000), 'YYYY-MM-DD HH24:MI:SS.MS+03:00') as datetime,
      glove,
      x+y+z g
    from gloves
    order by timestamp
  )
  select datetime x, g y, glove
  from _gloves
  where glove = 'R' and g > 0;
  `;
  let query_dataset_bag = `
  WITH _bag as (
    select DISTINCT
      timestamp,
      TO_CHAR(TO_TIMESTAMP(timestamp::double precision/1000), 'YYYY-MM-DD HH24:MI:SS.MS+03:00') as datetime,
      x+y g
    from bag
    order by timestamp
  )
  select datetime x, g y
  from _bag
  where g > 0;
  `;
  let conn = new Connection();
  const result_L = await conn.query(query_dataset_L);
  const result_R = await conn.query(query_dataset_R);
  const result_bag = await conn.query(query_dataset_bag);
  const result_L_h = await conn.query(query_dataset_L_hour);
  const result_R_h = await conn.query(query_dataset_R_hour);
  const result_bag_h = await conn.query(query_dataset_bag_hour);
  conn.close();
  data_L = result_L_h.rows;
  data_R = result_R_h.rows;
  data_bag = result_bag_h.rows;
  data_L_all = result_L.rows;
  data_R_all = result_R.rows;
  data_bag_all = result_bag.rows;
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
    if (req.url == '/gloves') {
      let stat = fs.statSync(`./${glovesFN}`);
      res.writeHead(200, {
        'Content-Type': 'image/jpg',
        'Content-Length': stat.size
      });
      fs.createReadStream(`./${glovesFN}`)
        .pipe(res);
      return;
    }
    if (req.url == '/gloves_hour') {
      let stat = fs.statSync(`./${gloves_hourFN}`);
      res.writeHead(200, {
        'Content-Type': 'image/jpg',
        'Content-Length': stat.size
      });
      fs.createReadStream(`./${gloves_hourFN}`)
        .pipe(res);
      return;
    }
    console.log("Incoming GET");
    res.writeHead(200, {'Content-Type': 'text/plain'});
    updateStats().then((stats) => {
      const promise_charts = updateCharts(stats);
      promise_charts.then((stats) => {
        console.log(stats);
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
      });
    })
  }
  console.log(`${op} from ${req.socket.remoteAddress}`);
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
