-- DB Schema

CREATE TABLE bag (
    "timestamp" bigint NOT NULL,
    x integer NOT NULL,
    y integer NOT NULL,
    z integer NOT NULL,
    temperature integer
);


CREATE TABLE gloves (
    "timestamp" bigint NOT NULL,
    glove "char" NOT NULL,
    x integer NOT NULL,
    y integer NOT NULL,
    z integer NOT NULL
);


ALTER TABLE ONLY bag
    ADD CONSTRAINT bag_pkey PRIMARY KEY ("timestamp");


ALTER TABLE ONLY gloves
    ADD CONSTRAINT gloves_pkey PRIMARY KEY ("timestamp");
