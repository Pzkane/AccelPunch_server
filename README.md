# AccelPunch_server
AccelPunch: REST server for data aggregation and statistics

> Server: NodeJS

>Database: Postgres

1. Create database with name "AccelPunch_database"
2. Run `AccelPunch_schema.sql` for schema import
3. Run `npm install`
4. Create copy of `.env.example` file into new `.env` file and fill values  accordingly
4. Run `node servlet.js`

On received _GET_ request server will generate graph _gloves.jpg_ image with your performance data points.

## Data Origin

[AccelPunch_application](https://github.com/Pzkane/AccelPunch_application)

## Data Receiver

Database (self)
